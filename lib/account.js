var Model       = require("./model")
var filters     = require("./filters")
var validations = require("./validations")
var auth        = require("./password")

module.exports = function(client) {

  var account = new Model({
    "locals": {
      "modelname": "account",  
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
    client.hgetall(modelname + ":" + id, function(err, obj){
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
      var key = modelname + ":" + obj.id
      client.hgetall(key, function(err, old){
        client.multi()
        .del(modelname + ":email:" + old.email)
        .del(modelname + ":username:" + old.username)
        .del(modelname + ":uuid:" + old.uuid)
        .hmset(key, obj)
        .set(modelname + ":email:" + obj.email, obj.id)
        .set(modelname + ":username:" + obj.username, obj.id)
        .set(modelname + ":uuid:" + obj.uuid, obj.id)
        .exec(function(err, replies){
          if(!err) cb(null, obj)
        })
      })
    }else{
      // new
      client.incr(modelname + ":nextId", function(err, id){
        obj.id = id
        var key = modelname + ":" + id;
        client.multi()
        .hmset(key, obj)
        .set(modelname + ":uuid:" + obj.uuid, obj.id)
        .set(modelname + ":email:" + obj.email, obj.id)
        .set(modelname + ":username:" + obj.username, obj.id)
        .exec(function(err, replies){
          if(!err) cb(null, obj)
        })
      })
    }
  }
  
  account.constructor.prototype.authenticate = function(username, password, cb){
    var that = this
    client.get(modelname + ":username:" + username, function(err, id){
      if(id){
        that.read(id, function(obj){
          if(auth.validate(obj.hash, password)){
            client.multi()
            .hincrby(modelname +":" + id, "login_count", 1)
            .hset(modelname + ":" + id, "login_at", (new Date()).toJSON())
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
