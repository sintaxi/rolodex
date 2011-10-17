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
      global.uuid = account["uuid"] // global
      test.deepEqual(account["id"], 1)
      test.deepEqual(account["email"],"brock@sintaxi.com")
      test.deepEqual(account["username"],"sintaxi")
      test.done()
    })
  },

  "should get by id": function(test) {
    rolodex.account.getById(1, function(account){
      test.deepEqual(account["id"], 1)
      test.deepEqual(account["email"],"brock@sintaxi.com")
      test.deepEqual(account["username"],"sintaxi")
      test.done()
    })
  },

  "should get by username": function(test) {
    rolodex.account.getByUsername("sintaxi", function(account){
      test.deepEqual(account["id"], 1)
      test.deepEqual(account["email"],"brock@sintaxi.com")
      test.deepEqual(account["username"],"sintaxi")
      test.done()
    })
  },

  "should get by email": function(test) {
    rolodex.account.getByEmail("brock@sintaxi.com", function(account){
      test.deepEqual(account["id"], 1)
      test.deepEqual(account["email"],"brock@sintaxi.com")
      test.deepEqual(account["username"],"sintaxi")
      test.done()
    })
  },

  "should get by uuid": function(test) {
    rolodex.account.getByUUID(uuid, function(account){
      test.deepEqual(account["id"], 1)
      test.deepEqual(account["email"],"brock@sintaxi.com")
      test.deepEqual(account["username"],"sintaxi")
      test.deepEqual(account["uuid"], uuid)
      test.done()
    })
  },

  "cleanup": function(test){
    client.flushall()
    client.quit()
    test.done()
  }

})
