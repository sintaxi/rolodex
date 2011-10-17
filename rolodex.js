var account = require("./lib/account")

module.exports = function(client) {
  
  return {
    account: account(client)
  }
}
