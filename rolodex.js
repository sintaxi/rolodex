var redis   = require("redis")
var upnode  = require("upnode")

module.exports = function(options) {
  if(!options) options = {}
  
  if(options.hasOwnProperty("role") && options["role"] == "master"){
    var client = redis.createClient()   // TODO: doesnt like empty obj. make me configurable!!!
    var account = require("./models/account")(client)
    return {
      account: account,
      listen: function(args){
        upnode({ account: account }).listen(args, function(){
          console.log("Rolodex is listening on port", args)
        })
      }
    }    
  }else{

    var up = upnode.connect(options.port)
    
    var daccount = {
      set: function(){
        var args = arguments
        up(function(rolodex){
          rolodex.account.set.apply(this, args)
        })
      },
      get: function(){
        var args = arguments
        up(function(rolodex){
          rolodex.account.get.apply(this, args)
        })
      },
      validate: function(){
        var args = arguments
        up(function(rolodex){
          rolodex.account.validate.apply(this, args)
        })
      },
      authenticate: function(){
        var args = arguments
        up(function(rolodex){
          console.log(rolodex.account)
          rolodex.account.authenticate.apply(this, args)
        })
      }
    }

    return {
      account: daccount,
      listen: function(args){
        upnode({ account: daccount }).listen(args, function(){
          console.log("Rolodex is listening on port", args)
        })
      }
    }
    
  }
}
