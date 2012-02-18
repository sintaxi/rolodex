var should = require("should")

describe("create", function(){
  var redis = require("redis")
  var client = redis.createClient()
  var rolodex = require("../rolodex")(client)

  var validAccountDetails = {
    "username": "sintaxi",
    "email": "brock@sintaxi.com",
    "password":"foobar"
  }

  it("should not create account wihtout args", function(done) {
    rolodex.account.create({}, function(errors, account){
      errors.should.have.property("fields")
      errors.should.have.property("messages")
      errors.fields.should.have.property("email", "must be present")
      errors.fields.should.have.property("username", "must be present")
      errors.fields.should.have.property("password", "must be present")
      errors.messages.should.include("email must be present")
      errors.messages.should.include("username must be present")
      errors.messages.should.include("password must be present")
      done()
    })
  })

  it("should create account", function(done) {
    var accountParams = {
      "username": "sintaxi",
      "email": "brock@sintaxi.com",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      account.should.have.property("id", 1)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("username", "sintaxi")
      account.should.have.property("uuid")
      account.should.have.property("hash")
      account.should.have.property("login_at")
      account.should.have.property("login_count", 0)
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  it("should not create account without unique username and email", function(done) {
    var accountParams = {
      "username": "sintaxi",
      "email": "brock@sintaxi.com",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      errors.messages.sort().should.eql(["username already in use", "email already in use"].sort())
      errors.fields.should.have.property("username", "already in use")
      errors.fields.should.have.property("email", "already in use")
      done()
    })
  })

  it("should not create account without email", function(done) {
    var accountParams = {
      "username": "foobar",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      errors.messages.should.include("email must be present")
      done()
    })
  })

  it("should not create account without valid email", function(done) {
    var accountParams = {
      "username": "foobar",
      "email": "brockatsintaxi.com",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      errors.messages.should.include("email must be valid")
      done()
    })
  })

  it("should not create account without username", function(done) {
    var accountParams = {
      "email": "brock@foobar.com"
    }
    rolodex.account.create(accountParams, function(errors, account){
      errors.messages.should.include("password must be present")
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

