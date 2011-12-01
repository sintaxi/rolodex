var uuid = require("node-uuid")
var validator = require("validator")
var check = validator.check

var auth = require("./password")

module.exports = function(client) {

  var Account = (function() {
    
    function Account(obj) {
      if(obj["id"]) 
        this.id = obj["id"]

      if(obj["updated_at"])
        this.updated_at = obj["updated_at"]
      
      if(obj["created_at"])
        this.created_at = obj["created_at"]
      
      if(obj["uuid"])
        this.uuid = obj["uuid"]

      if(obj["hash"])
        this.hash = obj["hash"]

      if(obj["login_at"])
        this.login_at = obj["login_at"]

      if(obj["login_count"])
        this.login_count = obj["login_count"]

      if(obj["password"] && obj["password"] != "")
        this.password = obj["password"]

      // we need these to validate on
      this.email = obj["email"] || ""
      this.username = obj["username"] || "" 
    }

    Account.prototype.validate = function(cb){
      var errors = {
        fields: {},
        messages: []
      }
      var that = this

      // validate email
      client.get("email:" + that.email, function(err, id){
        try {
          check(that.email, "Email address must be present").notEmpty()
          check(that.email, "Email address must be valid").isEmail()
        } catch (e) {
          errors.messages.push(e.message)
          errors.fields["email"] = e.message.split("Email address ")[1]
        }
        if(id){
          if(that.id){
            if(that.id != id){
              errors.messages.push("Email address already in use")
              errors.fields["email"] = "already in use"
            }
          }else{
            errors.messages.push("Email address already in use")
            errors.fields["email"] = "already in use"
          }
        }
        
        // validate username
        client.get("username:" + that.username, function(err, id){
          try {
            check(that.username, "Username must be present").notEmpty()
            check(that.username, "Username must be between 3 and 24 characters").len(2, 24)
            check(that.username, "Username may only contain alpha characters").isAlpha()
          } catch (e) {
            errors.messages.push(e.message)
            errors.fields["username"] = e.message.split("Username ")[1]
          }
          if(id){
            if(that.id){
              if(that.id != id){
                errors.messages.push("Username already in use")
                errors.fields["username"] = "already in use"
              }
            }else{
              errors.messages.push("Username already in use")
              errors.fields["username"] = "already in use"
            }
          }

          // validate password
          if(!that.hash || that.password){
            try {
              check(that.password, "Password must be present").notEmpty()
              check(that.password, "Password must be between 6 and 32 characters").len(6, 32)
            } catch (e) {
              errors.messages.push(e.message)
              errors.fields["password"] = e.message.split("Password ")[1]
            }
          }
         
          if(errors.messages.length > 0){
            cb(errors)
          }else{
            cb(null)
          }
            
        })
          
      })
       
    }

    Account.prototype.setId = function(id){
      this.id = id
    }

    Account.prototype.setUpdatedAt = function(){
      this.updated_at = (new Date()).toJSON()
    }

    Account.prototype.setCreatedAt = function(){
      this.created_at = (new Date()).toJSON()
    }

    Account.prototype.setUUID = function(){
      this.uuid = uuid.v4()
    }

    Account.prototype.setLoginInfo = function(){
      this.login_at = null 
      this.login_count = 0 
    }

    Account.prototype.setHash = function(){
      if(this.password){
        this.hash = auth.hash(this.password)
      }
    }

    Account.prototype.removePassword = function(){
      delete this.password
    }

    Account.prototype.store = function(cb){
      this.setUpdatedAt()
      this.removePassword()
      var that = this
      var key = "account:" + that.id

      client.hgetall(key, function(err, old){
        if(old && JSON.stringify(old) != JSON.stringify({})){
          client.multi()
          .del("email:" + old.email)
          .del("username:" + old.username)
          .del("uuid:" + old.uuid)
          .hmset(key, that)
          .set("email:" + that.email, that.id)
          .set("username:" + that.username, that.id)
          .set("uuid:" + that.uuid, that.id)
          .exec(function(err, replies){
            if(!err) cb(null, that)
          })
        }else{
          client.multi()
          .hmset(key, that)
          .set("uuid:" + that.uuid, that.id)
          .set("email:" + that.email, that.id)
          .set("username:" + that.username, that.id)
          .exec(function(err, replies){
            if(!err) cb(null, that)
          })
        }

      })

    }

    Account.prototype.save = function(cb){
      var that = this
      this.validate(function(errors){
        if(errors){
          cb(errors)
        }else{
          that.setHash()
          if(that.id){
            that.store(cb)
          }else{
            client.incr("account:nextId", function(err, id){
              that.setId(id)
              that.setCreatedAt()
              that.setLoginInfo()
              that.setUUID()
              that.store(cb)
            })
          }
        }
      })
    }

    return Account;

  })()

  return {

    create: function(obj, cb){
      var account = new Account(obj)
      account.save(function(errors, account){
        if(errors){
          cb(errors)
        }else{
          cb(null, account)
        }
      })
    },

    update: function(id, args, cb){
      client.hgetall("account:" + id, function(err, obj){
        if(!err){
          var oldAccount = new Account(obj)

          // whitelist for security (for now)
          if(args["email"]) obj.email = args.email
          if(args["username"]) obj.username = args.username
          if(args["password"]) obj.password = args.password

          var account = new Account(obj)
          account.save(function(errors, account){
            if(errors){
              cb(errors)
            }else{
              cb(null, account)
            }
          })
        }

      })
    },

    authenticate: function(username, password, cb){
      client.get("username:" + username, function(err, id){
        if(id){
          client.hgetall("account:" + id, function(err, obj){
            var account = new Account(obj)
            if(auth.validate(account.hash, password)){
              client.multi()
                .hincrby("account:" + id, "login_count", 1)
                .hset("account:" + id, "login_at", (new Date()).toJSON())
                .exec(function(err, replies){
                  cb(null, account)
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
    },

    getById: function(id, cb){
      client.hgetall("account:" + id, function(err, obj){
        if(obj){
          var account = new Account(obj)
          cb(account)
        }else{
          cb(null)
        }
      })
    },

    getByUsername: function(username, cb){
      client.get("username:" + username, function(err, id){
        if(id){
          client.hgetall("account:" + id, function(err, obj){
            if(obj){
              var account = new Account(obj)
              cb(account)
            }else{
              cb(null)
            }
          })
        }else{
          cb(null)
        }
      })
    },

    getByUUID: function(uuid, cb){
      client.get("uuid:" + uuid, function(err, id){
        if(id){
          client.hgetall("account:" + id, function(err, obj){
            if(obj){
              var account = new Account(obj)
              cb(account)
            }else{
              cb(null)
            }
          })
        }else{
          cb(null)
        }
      })
    },

    getByEmail: function(email, cb){
      client.get("email:" + email, function(err, id){
        if(id){
          client.hgetall("account:" + id, function(err, obj){
            if(obj){
              var account = new Account(obj)
              cb(account)
            }else{
              cb(null)
            }
          })
        }else{
          cb(null)
        }
      })
    }

  } // return

}
