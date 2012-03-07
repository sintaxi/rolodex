var base32      = require("base32")

var Model       = require("../lib/model")
var filters     = require("../lib/filters")
var validations = require("../lib/validations")
var hash        = require("../lib/hash")

module.exports = function(client) {

  var account = new Model({
    "locals": {
      "namespace": "account",
      "client": client
    },
    "filters": {
      "in": [
        filters.blacklist
      ],
      "before": [
        filters.uuid, 
        filters.hash, 
        filters.login_at, 
        filters.login_count, 
        filters.updated_at
      ],
      "after": [
        filters.password
      ],
      "out": [
        filters.clean
      ]
    },
    "validations": {
      "email"   : [validations.present, validations.email, validations.unique],
      "password": [validations.presentOnCreate]
    }
  })
  
  // Read the Record
  // - takes an `id`
  // - must fire callback with the record or `null`
  account.constructor.prototype.read = function(q, cb){
 
    // once done
    var callback = function(err, obj){
      for(var key in obj) break;
      key ? cb(obj) : cb(null)
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
  // - existing records will have an `id`
  // - new records will NOT have an `id`
  // - must fire callback with errors or the record
  account.constructor.prototype.write = function(obj, cb){
    if(obj.id){
      // existing
      var key = namespace + ":" + obj.id
      client.hgetall(key, function(err, old){
        client.multi()
        .del(namespace + ":email:" + old.email)
        .del(namespace + ":uuid:" + old.uuid)
        .hmset(key, obj)
        .set(namespace + ":email:" + obj.email, obj.id)
        .set(namespace + ":uuid:" + obj.uuid, obj.id)
        .exec(function(err, replies){
          if(!err) cb(null, obj)
        })
      })
    }else{
      // new
      var date = new Date()
      var timestamp = date.getTime()

      // lets set a human readable id for new accounts
      // these should remain 9 bits until around year 2056
      // not perfect but better than auto-inc or uuid IMHO
      obj.id = timestamp
        .toString(36)
        .split("")
        .reverse()
        .join("")
        .match(RegExp('.{1,4}', 'g'))
        .reverse()
        .join("-")

      // use same timestamp for created_at
      obj.created_at = date.toJSON()

      var key = namespace + ":" + obj.id;
      client.multi()
      .hmset(key, obj)
      .set(namespace + ":uuid:" + obj.uuid, obj.id)
      .set(namespace + ":email:" + obj.email, obj.id)
      .zadd(namespace + ":collection", timestamp, obj.id)
      .exec(function(err, replies){
        if(!err) cb(null, obj)
      })
    }
  }

  account.constructor.prototype.all = function(start, stop, cb){
    var that = this
    client.zrevrange(namespace + ":collection", start, stop, function(err, reply){
      var accounts = []
      var total = reply.length
      var count = 0
      reply.forEach(function(id){
        that.get(id, function(account){
          count++ 
          accounts.push(account)
          if(count == total){
            cb(accounts) 
          }
        })
      }) 
    })
  }
  
  account.constructor.prototype.authenticate = function(q, password, cb){
    var that = this
    that.read(q, function(obj){
      if(obj){
        if(hash.validate(obj.hash, password)){
          client.multi()
          .hincrby(namespace +":" + obj.id, "login_count", 1)
          .hset(namespace + ":" + obj.id, "login_at", (new Date()).toJSON())
          .exec(function(err, replies){
            that.get(obj.id, function(record){
              cb(null, record)
            })
          })
        }else{
          var errors = {
            fields: {"password": "is not correct"},
            messages: ["password is not correct"]
          }
          cb(errors, null)
        }
      }else{
        var errors = {
          fields: {"username": "is not in the system"},
          messages: ["username is not in the system"]
        }
        cb(errors, null)
      }
    })


  }
  
  return account
}
