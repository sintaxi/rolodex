var testCase = require('nodeunit').testCase

var redis = require("redis")
var client = redis.createClient()
var rolodex = require("../rolodex")(client)

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

  "should get errors wih incorrect username and password": function(test) {
    rolodex.account.authenticate("sintaxi", "foobaz", function(errors, account){
      test.deepEqual(errors[0], "Incorrect username and password")
      test.done()
    })
  },

  "should be authenticate using username and password": function(test) {
    rolodex.account.authenticate("sintaxi", "foobar", function(errors, account){
      test.deepEqual(account["id"], 1)
      test.deepEqual(account["email"],"brock@sintaxi.com")
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
