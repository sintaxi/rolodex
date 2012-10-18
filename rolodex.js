var redis   = require("redis")
var upnode  = require("upnode")

module.exports = function(options) {
  if(!options) options = {}
  
  // TODO: improve this feedback message
  
  // need role config in production
  if(!options.hasOwnProperty("role")){
    throw "<role> required in configuration"
  }
  
  // need email config in production
  if(process.env.NODE_ENV === "production"){
    if(!options.hasOwnProperty("email")){
      throw "<email> required in configuration in production mode."
    }
  }

  if(options.hasOwnProperty("role") && options["role"] == "slave"){
    // slave
    
    var up = upnode.connect(options.master)
    var port = options.port
    
    var daccount = {
      set: function(){
        var args = Array.prototype.slice.call(arguments);
        up(function(rolodex){
          rolodex.account.set.apply(rolodex.account, args)
        })
      },
      
      get: function(){
        var args = Array.prototype.slice.call(arguments);
        up(function(rolodex){
          rolodex.account.get.apply(rolodex.account, args)
        })
      },
      
      validate: function(){
        var args = Array.prototype.slice.call(arguments);
        up(function(rolodex){
          rolodex.account.validate.apply(rolodex.account, args)
        })
      },
      
      authenticate: function(){
        var args = Array.prototype.slice.call(arguments);
        up(function(rolodex){
          rolodex.account.authenticate.apply(rolodex.account, args)
        })
      },
      
      group: function(){
        var args = Array.prototype.slice.call(arguments);
        up(function(rolodex){
          rolodex.account.group.apply(rolodex.account, args)
        })
      },
      
      all: function(){
        var args = Array.prototype.slice.call(arguments);
        up(function(rolodex){
          rolodex.account.all.apply(rolodex.account, args)
        })
      },
      
      email: function(){
        var args = Array.prototype.slice.call(arguments);
        // this is a mess
        if(options.hasOwnProperty("email")){
          if(options.email.hasOwnProperty("postmark")){
            args[1]["postmark"] = options.email.postmark
          } 
          if(options.email.hasOwnProperty("defaults")){
            if(!args[1].hasOwnProperty("from") && options.email.defaults.hasOwnProperty("from")){
              args[1]["from"] = options.email.defaults.from
            }
            if(!args[1].hasOwnProperty("reply_to") && options.email.defaults.hasOwnProperty("reply_to")){
              args[1]["reply_to"] = options.email.defaults.reply_to
            }
          }
        }
        up(function(rolodex){
          rolodex.account.email.apply(rolodex.account, args)
        })
      }
    }

    return {
      account: daccount
    }


  }else{
    // master
    options.store = options.store || {}
    options.email = options.email || {}
    
    var client = redis.createClient(options.redis)
    
    var account = require("./models/account")({
      client: client,
      email : options.email
    })
    
    return {
      account: account,
      listen: function(args){
        return upnode({ account: account }).listen(args, function(){
          console.log("Rolodex Master is listening on port", args)
        })
      }
    }
    
    
  }
}
