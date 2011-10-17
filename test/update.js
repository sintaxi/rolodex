var testCase = require('nodeunit').testCase

var redis = require("redis")
var client = redis.createClient()
var rolodex = require("../rolodex")(client)

var validAccountDetails = {
  "username": "sintaxi",
  "email": "brock@sintaxi.com",
  "password":"foobar"
}

module.exports = testCase({

  "should create account": function(test) {
    var accountParams = {
      "username": "sintaxi",
      "email": "brock@sintaxi.com",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      test.deepEqual(account["id"], 1)
      test.deepEqual(account["email"],"brock@sintaxi.com")
      test.deepEqual(account["username"],"sintaxi")
      test.done()
    })
  },

  "should be able to change username": function(test) {
    var accountParams = { "username": "brock" }
    rolodex.account.update(1, accountParams, function(errors, account){
      test.deepEqual(account["id"], 1)
      test.deepEqual(account["email"],"brock@sintaxi.com")
      test.deepEqual(account["username"],"brock")
      test.done()
    })
  },

  "should free up unused username": function(test) {
    var accountParams = {
      "username": "sintaxi",
      "email": "brock@example.com",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      test.deepEqual(account["username"],"sintaxi")
      test.done()
    })
  },

  "cleanup": function(test){
    client.flushall()
    client.quit()
    test.done()
  }

})
