//var account = require("./lib/account")

// var Model       = require("./lib/model")
// var filters     = require("./lib/filters")
// var validations = require("./lib/validations")
// var auth = require("./lib/password")

module.exports = function(client) {
  
  var account = require("./lib/account")(client)
  
  return {
    account: account
  }
  
}
