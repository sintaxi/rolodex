module.exports = function(client) {
  
  var account = require("./models/account")(client)
  
  return {
    account: account
  }
  
}
