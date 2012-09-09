var redis = require("redis")

module.exports = function(options) {
  
  var client = redis.createClient(options)
  var account = require("./models/account")(client)
  
  return {
    account: account
  }
  
}
