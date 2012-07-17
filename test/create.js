var should = require("should")

describe("create", function(){
  var redis = require("redis")
  var client = redis.createClient()
  var rolodex = require("../rolodex")(client)

  var validAccountDetails = { "email": "brock@sintaxi.com" }

  it("should not create account wihtout args", function(done) {
    rolodex.account.create({}, function(errors, account){
      errors.should.have.property("details")
      errors.should.have.property("messages")
      errors.details.should.have.property("email", "must be present")
      errors.messages.should.include("email must be present")
      done()
    })
  })

  it("should create account", function(done) {
    var accountParams = { "email": "brock@sintaxi.com" }
    rolodex.account.create(accountParams, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("login_at")
      account.should.have.property("login_count", 0)
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      account.should.not.have.property("password")
      done()
    })
  })

  it("should not create account without unique email", function(done) {
    var accountParams = { "email": "brock@sintaxi.com" }
    rolodex.account.create(accountParams, function(errors, account){
      errors.messages.sort().should.eql(["email already in use"].sort())
      errors.details.should.have.property("email", "already in use")
      done()
    })
  })

  it("should not create account without email", function(done) {
    var accountParams = {}
    rolodex.account.create(accountParams, function(errors, account){
      errors.messages.should.include("email must be present")
      done()
    })
  })

  it("should not create account without valid email", function(done) {
    var accountParams = { "email": "brockatsintaxi.com" }
    rolodex.account.create(accountParams, function(errors, account){
      errors.messages.should.include("email must be valid")
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

