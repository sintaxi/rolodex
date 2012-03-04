var Model       = require("../lib/model")
var filters     = require("../lib/filters")
var validations = require("../lib/validations")
var auth        = require("../lib/hash")

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
        filters.created_at, 
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
      "username": [validations.present, validations.unique],
      "password": [validations.presentOnCreate]
    }
  })
  
  // Read the Record
  // - takes an `id`
  // - must fire callback with the record or `null`
  account.constructor.prototype.read = function(q, cb){
    if(typeof q == 'object'){
      for(var key in q) break;
      client.get(namespace + ":" + key + ":" + q[key], function(err, id){
        client.hgetall(namespace + ":" + id, function(err, obj){
          cb(obj)
        })
      })
    }else{
      client.hgetall(namespace + ":" + q, function(err, obj){
        cb(obj)
      })
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
        .del(namespace + ":username:" + old.username)
        .del(namespace + ":uuid:" + old.uuid)
        .hmset(key, obj)
        .set(namespace + ":email:" + obj.email, obj.id)
        .set(namespace + ":username:" + obj.username, obj.id)
        .set(namespace + ":uuid:" + obj.uuid, obj.id)
        .exec(function(err, replies){
          if(!err) cb(null, obj)
        })
      })
    }else{
      // new
      client.incr(namespace + ":nextId", function(err, id){
        obj.id = id
        var key = namespace + ":" + id;
        client.multi()
        .hmset(key, obj)
        .set(namespace + ":uuid:" + obj.uuid, obj.id)
        .set(namespace + ":email:" + obj.email, obj.id)
        .set(namespace + ":username:" + obj.username, obj.id)
        .exec(function(err, replies){
          if(!err) cb(null, obj)
        })
      })
    }
  }
  
  account.constructor.prototype.authenticate = function(username, password, cb){
    var that = this
    client.get(namespace + ":username:" + username, function(err, id){
      if(id){
        that.read(id, function(obj){
          if(auth.validate(obj.hash, password)){
            client.multi()
            .hincrby(namespace +":" + id, "login_count", 1)
            .hset(namespace + ":" + id, "login_at", (new Date()).toJSON())
            .exec(function(err, replies){
              that.get(id, function(record){
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
        })
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
