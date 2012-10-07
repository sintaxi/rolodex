var redis   = require("redis")
var upnode  = require("upnode")

module.exports = function(options) {
  if(!options) options = {}

  if(options.hasOwnProperty("role") && options["role"] == "slave"){
    // slave
    
    var up = upnode.connect(options.port)
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
      }
    }

    return {
      account: daccount
      
      // the SLAVE becomes a MASTER (not yet ready)
      //
      // ,listen: function(args){
      //   upnode({ account: daccount }).listen(args, function(){
      //     console.log("Rolodex " + options.role + " listening on port", args)
      //   })
      // }
    }


  }else{
    // master
    
    var client = redis.createClient(options.redis)
    var account = require("./models/account")(client)
    
    return {
      account: account,
      listen: function(args){
        upnode({ account: account }).listen(args, function(){
          console.log("Rolodex Master is listening on port", args)
        })
      }
    }
    
    
  }
}
