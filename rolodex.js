var redis = require("redis")
var dnode = require("dnode")

module.exports = function(options) {
  
  var client = redis.createClient(options)
  var account = require("./models/account")(client)
  
  return {
    account: account,
    
    listen: function(args){
      dnode(account).listen(args)
    }
  }
  
}
