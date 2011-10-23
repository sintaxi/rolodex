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

  "should not create account wihtout args": function(test) {
    rolodex.account.create({}, function(errors, account){
      test.deepEqual(errors.messages.sort(), ["Password must be present", "Email address must be present", "Username must be present"].sort())
      test.deepEqual(errors.fields["password"], "must be present")
      test.deepEqual(errors.fields["username"], "must be present")
      test.done()
    })
  },

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

  "should not create account without unique username and email": function(test) {
    var accountParams = {
      "username": "sintaxi",
      "email": "brock@sintaxi.com",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      test.deepEqual(errors.messages.sort(), ["Username already in use", "Email address already in use"].sort())
      test.deepEqual(errors.fields["username"], "already in use")
      test.deepEqual(errors.fields["email"], "already in use")
      test.done()
    })
  },

  "should not create account without email": function(test) {
    var accountParams = {
      "username": "foobar",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      test.deepEqual(errors.messages, ["Email address must be present"])
      test.done()
    })
  },

  "should not create account without valid email": function(test) {
    var accountParams = {
      "username": "foobar",
      "email": "brockatsintaxi.com",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      test.deepEqual(errors.messages, ["Email address must be valid"])
      test.done()
    })
  },

  "should not create account without username": function(test) {
    var accountParams = {
      "email": "brock@foobar.com"
    }
    rolodex.account.create(accountParams, function(errors, account){
      test.deepEqual(errors.messages.sort(), ["Password must be present", "Username must be present"].sort())
      test.done()
    })
  },

  "cleanup": function(test){
    client.flushall()
    client.quit()
    test.done()
  }

})
