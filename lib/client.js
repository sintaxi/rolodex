var redis = require("redis")

// callback adapter over node-redis 5 exposing the v2-era client surface the
// models were written against. semantic differences handled here so call
// sites stay untouched:
//   - hgetall of a missing key returns null (v5 returns {}, which is truthy
//     and would make missing accounts look found)
//   - hgetall replies get Object.prototype back (v5 returns null-prototype
//     objects, which break hasOwnProperty in the out filters)
//   - lowercase command names, callback-last, values stringified as v2 did

var translate = function(options){
  if(typeof options === "number") return { socket: { port: options } }
  if(typeof options === "string") return { url: options }
  if(options && typeof options === "object"){
    var config = { socket: {} }
    if(options.host) config.socket.host = options.host
    if(options.port) config.socket.port = options.port
    if(options.password) config.password = options.password
    if(options.db != null) config.database = options.db
    return config
  }
  return {}
}

var stringify = function(obj){
  var out = {}
  for(var key in obj){
    if(obj.hasOwnProperty(key)) out[key] = String(obj[key])
  }
  return out
}

var record = function(reply){
  if(!reply || Object.keys(reply).length === 0) return null
  return Object.assign({}, reply)
}

module.exports = function(options){
  var client = redis.createClient(translate(options))

  client.on("error", function(err){
    console.error("rolodex redis error:", err.message)
  })

  // commands issued while connecting are queued by node-redis
  client.connect().catch(function(){})

  var wrap = function(promise, cb){
    promise.then(function(reply){
      if(cb) cb(null, reply)
    }, function(err){
      if(cb) cb(err)
    })
  }

  return {

    get: function(key, cb){
      wrap(client.get(key), cb)
    },

    set: function(key, value, cb){
      wrap(client.set(key, String(value)), cb)
    },

    del: function(key, cb){
      wrap(client.del(key), cb)
    },

    expire: function(key, seconds, cb){
      wrap(client.expire(key, seconds), cb)
    },

    hset: function(key, field, value, cb){
      wrap(client.hSet(key, field, String(value)), cb)
    },

    hgetall: function(key, cb){
      client.hGetAll(key).then(function(reply){
        cb(null, record(reply))
      }, function(err){
        cb(err)
      })
    },

    zrevrange: function(key, start, stop, cb){
      wrap(client.zRange(key, start, stop, { REV: true }), cb)
    },

    zrevrangebyscore: function(key, max, min, cb){
      wrap(client.zRange(key, max, min, { BY: "SCORE", REV: true }), cb)
    },

    multi: function(){
      var m        = client.multi()
      var hgetalls = []
      var index    = 0

      var chain = {
        set: function(key, value){
          m.set(key, String(value)); index++; return chain
        },
        del: function(key){
          m.del(key); index++; return chain
        },
        expire: function(key, seconds){
          m.expire(key, seconds); index++; return chain
        },
        hset: function(key, field, value){
          m.hSet(key, field, String(value)); index++; return chain
        },
        hmset: function(key, obj){
          m.hSet(key, stringify(obj)); index++; return chain
        },
        zadd: function(key, score, member){
          m.zAdd(key, { score: Number(score), value: String(member) }); index++; return chain
        },
        zrem: function(key, member){
          m.zRem(key, String(member)); index++; return chain
        },
        hgetall: function(key){
          hgetalls.push(index); m.hGetAll(key); index++; return chain
        },
        exec: function(cb){
          m.exec().then(function(replies){
            hgetalls.forEach(function(i){
              replies[i] = record(replies[i])
            })
            cb(null, replies)
          }, function(err){
            cb(err)
          })
        }
      }

      return chain
    },

    flushall: function(cb){
      wrap(client.flushAll(), cb)
    },

    quit: function(cb){
      wrap(client.close(), cb)
    }

  }
}
