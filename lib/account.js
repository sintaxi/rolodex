var Model       = require("./model")
var filters     = require("./filters")
var validations = require("./validations")
var auth        = require("./password")

module.exports = function(client) {

  var account = new Model({
    "globals": {
      "name": "account",  
      "client": client
    },
    "filters": {
      "in"    :[
        filters.blacklist
      ],
      "before":[
        filters.uuid, 
        filters.hash, 
        filters.login_at, 
        filters.login_count, 
        filters.created_at, 
        filters.updated_at
      ],
      "after" :[
        filters.password
      ],
      "out"   :[
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
  account.constructor.prototype.read = function(id, cb){
    client.hgetall(name + ":" + id, function(err, obj){
      cb(obj)
    })
  }
  
  // Write the Record
  // - existing records will have an `id`
  // - new records will NOT have an `id`
  // - must fire callback with errors or the record
  account.constructor.prototype.write = function(obj, cb){
    if(obj.id){
      // existing
      var key = name + ":" + obj.id
      client.hgetall(key, function(err, old){
        client.multi()
        .del(name + ":email:" + old.email)
        .del(name + ":username:" + old.username)
        .del(name + ":uuid:" + old.uuid)
        .hmset(key, obj)
        .set(name + ":email:" + obj.email, obj.id)
        .set(name + ":username:" + obj.username, obj.id)
        .set(name + ":uuid:" + obj.uuid, obj.id)
        .exec(function(err, replies){
          if(!err) cb(null, obj)
        })
      })
    }else{
      // new
      client.incr(name + ":nextId", function(err, id){
        obj.id = id
        var key = name + ":" + id;
        client.multi()
        .hmset(key, obj)
        .set(name + ":uuid:" + obj.uuid, obj.id)
        .set(name + ":email:" + obj.email, obj.id)
        .set(name + ":username:" + obj.username, obj.id)
        .exec(function(err, replies){
          if(!err) cb(null, obj)
        })
      })
    }
  }
  
  account.constructor.prototype.authenticate = function(username, password, cb){
    var that = this
    client.get(name + ":username:" + username, function(err, id){
      if(id){
        that.read(id, function(obj){
          if(auth.validate(obj.hash, password)){
            client.multi()
            .hincrby(name +":" + id, "login_count", 1)
            .hset(name + ":" + id, "login_at", (new Date()).toJSON())
            .exec(function(err, replies){
              that.get(id, function(record){
                cb(null, record)
              })
            })
          }else{
            var errors = {
              fields: {"password": "is not correct"},
              messages: ["Password is not correct"]
            }
            cb(errors, null)
          }
        })
      }else{
        var errors = {
          fields: {"username": "is not in the system"},
          messages: ["Username is not in the system"]
        }
        cb(errors, null)
      }
    }) 
  }
  
  return account
}
