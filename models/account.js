var crypto      = require("crypto")
var Thug        = require("thug")
var filters     = require("../lib/filters")
var validations = require("../lib/validations")
var hash        = require("../lib/hash")

// admin filters

var fetchAccount = function(obj, next){
  this.locals.account.get(obj.account, function(record){
    obj["account"] = record;
    next(obj)
  })
}

var fetchPromoter = function(obj, next){
  this.locals.account.get(obj.promoter, function(record){
    obj["promoter"] = record;
    next(obj)
  })
}

// admin validations

var mustExist = function(field, obj, errors, next){
  if(obj[field] == null) errors.push("must exist")
  next()
}

var cantBeSelf = function(field, obj, errors, next){
  if(obj.role != null && obj.promoter != null){
    if(obj.account.id == obj.promoter.id){
      errors.push("cannot be same as account")
    }
  }
  next()
}


module.exports = function(config) {
  config       = config || {}
  config.email = config.email || {}

  var message = require("./message")(config.email)

  var account = new Thug({
    "locals": {
      "namespace": "account",
      "client": config.client
    },
    "filters": {
      "in": [
        filters.whitelist
      ],
      "beforeValidate": [
        filters.id,
        filters.uuid,
        filters.role
      ],
      "beforeWrite": [
        filters.hash,
        filters.password,
        filters.verified_at,
        filters.updated_at,
        filters.created_at
      ],
      "out": [
        filters.clean
      ]
    },
    "validations": {
      "first_name": [
        validations.name
      ],
      "last_name": [
        validations.name
      ],
      "email": [
        validations.present,
        validations.email,
        validations.unique,
        validations.verifiedEmail
      ],
      "password": [
        validations.presentPassword,
        validations.confirmation
      ]
    },
    "methods": {

      authtoken: function(q, password, callback){
        var namespace = this.locals.namespace
        var client    = this.locals.client
        var that      = this

        if(!callback){
          callback = password
          that.authenticate(q, function(err, acct){
            if(err) return callback(err)
            that.token(acct.id, callback)
          })
        }else{
          that.authenticate(q, password, function(err, acct){
            if(err) return callback(err, null)
            that.token(acct.id, callback)
          })
        }
      },

      // generates token (non-authenticating)
      token: function(q, exp, callback){
        var namespace = this.locals.namespace
        var client    = this.locals.client
        var that      = this

        if(!callback){
          callback = exp
          exp = 60 * 60 * 24 * 365
        }

        that.get(q, function(acct){
          if (!acct) return callback({
            details: {"token": "is not valid"},
            messages: ["token is not valid"]
          })
          var t = crypto.randomBytes(16).toString('hex')
          client.multi()
          .set("token:" + t, acct.id)
          .expire("token:" + t, exp)
          .exec(function(err, replies){
            callback(null, t)
          })
        })
      },

      authenticate: function(q, password, cb){
        var namespace = this.locals.namespace
        var client    = this.locals.client
        var that      = this

        if (!cb) {
          cb = password
          client.get("token:" + q, function(err, account_id){
            if (account_id === null) {
              return cb({
                details: {"token": "is not valid"},
                messages: ["token is not valid"]
              })
            }else{
              that.get(account_id, function(record){
                cb(null, record)
              })
            }
          })
        }else{
          that.read(q, function(obj){
            if(!obj){
              return cb({
                details: {"account": "is not in the system"},
                messages: ["account is not in the system"]
              }, null)
            }
            hash.validate(password, obj.hash, function(err, rsp){
              if(rsp === true){
                that.get(obj.id, function(record){
                  cb(null, record)
                })
              }else{
                cb({
                  details: {"password": "is not correct"},
                  messages: ["password is not correct"]
                }, null)
              }
            })
          })
        }

      },

      group: function(role, cb){
        var namespace = this.locals.namespace
        var client    = this.locals.client
        var that      = this

        client.zrevrangebyscore(namespace + ":collection:role", role, role, function(err, reply){
          if(err){
            cb([])
          }else{
            var transaction = client.multi()
            reply.forEach(function(id){
              transaction.hgetall(namespace + ":" + id)
            })
            transaction.exec(function(err, replies){
              var total = replies.length
              var count = 0
              if(total == 0){
                cb([])
              }else{
                replies.forEach(function(obj){
                  that.out(obj, function(record){
                    count++
                    if(count >= total){
                      cb(replies)
                    }
                  })
                })
              }
            })
          }
        })
      },

      all: function(start, stop, cb){
        var namespace = this.locals.namespace
        var client    = this.locals.client
        var that      = this

        if(!stop){
          cb    = start
          start = 0
          stop  = -1
        }

        client.zrevrange(namespace + ":collection:created_at", start, stop, function(err, reply){
          var total = reply.length
          if(total === 0){
            cb([])
          }else{
            var count = 0
            var transaction = client.multi()
            reply.forEach(function(id){
              transaction.hgetall(namespace + ":" + id)
            })
            transaction.exec(function(err, replies){
              replies.forEach(function(obj){
                that.out(obj, function(record){
                  count++
                  if(count == total){
                    cb(replies)
                  }
                })
              })
            })
          }
        })

      },

      email: function(identifier, msg, cb){
        this.read(identifier, function(record){
          if(record) msg.to = record.email
          message.set(msg, function(errors, reply){
            cb(errors, reply)
          })
        })
      },

      promote: function(identifier, role, promoter, callback){
        if(role == null) role = 5

        var that = this

        // helper function for upgrading role
        var upgradeRole = function(id, role, callback){
          var namespace = that.locals.namespace
          var client    = that.locals.client
          var key = namespace + ":" + id
          client.multi()
          .hset(key, "role", role)
          .zadd(namespace + ":collection:role", role, id)
          .exec(function(err, replies){
            if(!err) callback(true)
          })

          // obj.account.role = obj.role
          // this.locals.client.hset("account:" + id, "role", role, function(err, reply){
          //   if(!err) callback()
          // })
        }

        //////////////
        // filters
        //////////////

        var fixRole = function(obj, next){
          obj.role = parseInt(obj.role)
          if(obj.role < 0 || obj.role > 5)
            obj.role = 5
          next(obj)
        }

        //////////////
        // validations
        //////////////

        var mustBeHighEnough = function(field, obj, errors, next){
          if(obj.account != null && obj.promoter != null){
            if(obj.account.role < obj.promoter.role){
              errors.push("does not have high enough role")
            }
          }
          next()
        }

        var cantBeHigher = function(field, obj, errors, next){
          if(obj.role != null && obj.promoter != null){
            if(obj.role < obj.promoter.role){
              errors.push("cannot be higher than promoter")
            }
          }
          next()
        }

        var upgrader = new Thug({
          "locals": {
            "client": this.locals.client,
            "account": this
          },
          "filters":{
            "in": [fetchAccount, fetchPromoter, fixRole]
          },
          "validations": {
            "account": [mustExist],
            "promoter": [mustExist, cantBeSelf, mustBeHighEnough],
            "role": [mustExist, cantBeHigher]
          }
        })

        // setup write
        upgrader.constructor.prototype.write = function(identifier, obj, cb){
          obj.account.role = obj.role
          upgradeRole(obj.account.id, obj.role, function(reply){
            cb(obj.account)
          })
          // obj.account.role = obj.role
          // this.locals.client.hset("account:" + obj.account.id, "role", obj.account.role, function(err, reply){
          //   if(!err) cb(obj.account)
          // })
        }

        // return errors or account
        var self = this;
        upgrader.set({ account: identifier, role: role, promoter: promoter }, function(errors, record){
          if(errors){
            // upgrading own account
            if( errors["details"]["promoter"] && errors["details"]["role"] &&
                errors["details"]["promoter"] == "cannot be same as account" &&
                errors["details"]["role"] == "cannot be higher than promoter"){
                // self upgrade attempt. check to see if they are the only account
                self.all(function(accounts){
                  if(accounts.length == 1){
                    self.get(identifier, function(a){
                      // only account. upgrade it as requested
                      a.role = role
                      self.locals.client.hset("account:" + a.id, "role", a.role, function(err, reply){
                        if(!err) callback(null, a)
                      })
                    })
                  }else{
                    // not only account. throw errors as usual
                    callback(errors)
                  }
                })
            }else{
              // not self upgrade attempt
              callback(errors)
            }
          }else{
            // success
            callback(null, record)
          }
        })

      }

    }
  })

  // Read the Record
  // - takes an `id`
  // - must fire callback with the record or `null`
  account.constructor.prototype.read = function(q, cb){
    var namespace = this.locals.namespace
    var client    = this.locals.client

    // DRY - simplify to one callback
    var callback = function(err, obj){
      if(err) return cb(null)
      cb(obj)
    }

    if(typeof q == 'object'){
      for(var key in q) break;
      client.get(namespace + ":" + key + ":" + q[key], function(err, id){
        client.hgetall(namespace + ":" + id, callback)
      })
    }else{
      client.hgetall(namespace + ":" + q, callback)
    }
  }

  // Write the Record
  // - must fire callback with errors or the record
  account.constructor.prototype.write = function(identifier, obj, cb){
    var namespace = this.locals.namespace
    var client    = this.locals.client

    var key = namespace + ":" + obj.id
    client.hgetall(key, function(err, old){
      if(!old) old = {};
      client.multi()
      .del(namespace + ":email:" + old.email)
      .del(namespace + ":uuid:" + old.uuid)
      .hmset(key, obj)
      .set(namespace + ":email:" + obj.email, obj.id)
      .set(namespace + ":uuid:" + obj.uuid, obj.id)
      .zadd(namespace + ":collection:role", obj.role, obj.id)
      .zadd(namespace + ":collection:created_at", (new Date(obj.created_at).getTime()), obj.id)
      .exec(function(err, replies){
        if(!err) cb(obj)
      })
    })
  }

  // Remove the Record
  // - must fire callback with errors or the record
  account.constructor.prototype.remove = function(identifier, record, callback){
    var namespace = this.locals.namespace
    var client    = this.locals.client
    client.multi()
    .del(namespace + ":" + record.id)
    .del(namespace + ":email:" + record.email)
    .del(namespace + ":uuid:" + record.uuid)
    .zrem(namespace + ":collection:role", record.id)
    .zrem(namespace + ":collection:created_at", record.id)
    .exec(function(err, replies){
      if(!err) callback(null)
    })
  }

  return account
}
