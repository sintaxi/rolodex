var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

describe("create by password", function(){
  var rolodex = require("../")(config)

  var validAccountDetails = {
    "email": "brock@sintaxi.com",
    "password": "foobar",
    "password_confirmation": "foobar"
  }

  it("password must be present", function(done) {
    var accountParams = { "email": "brock@example.com" }
    rolodex.account.set(accountParams, function(errors, account){
      errors.messages.should.containEql("password must be present")
      done()
    })
  })

  it("password confirmation must be present", function(done) {
    var accountParams = { "email": "brock@example.com", "password": "foobar" }
    rolodex.account.set(accountParams, function(errors, account){
      errors.messages.should.containEql("password confirmation must be present")
      done()
    })
  })

  it("should create account with valid params", function(done) {
    rolodex.account.set(validAccountDetails, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("email_verified_at", null)
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      account.should.not.have.property("password")
      done()
    })
  })

  it("should be able to verify email", function(done) {
    validAccountDetails.email_verified = true
    rolodex.account.set({ email: validAccountDetails.email }, validAccountDetails, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("email_verified_at").not.be.null
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      account.should.not.have.property("password")
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

