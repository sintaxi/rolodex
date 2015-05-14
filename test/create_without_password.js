var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

describe("create by verified email", function(){
  var rolodex = require("../")(config)

  var validAccountDetails = {
    "email": "brock@sintaxi.com",
    "email_verified": true
  }

  it("should not create account without args", function(done) {
    var accountParams = {}
    rolodex.account.set(accountParams, function(errors, account){
      errors.should.have.property("details")
      errors.should.have.property("messages")
      errors.details.should.have.property("email", "must be present")
      errors.messages.should.containEql("email must be present")
      done()
    })
  })

  it("should validate password if no verified email property", function(done) {
    var accountParams = { "email": "brock@example.com" }
    rolodex.account.set(accountParams, function(errors, account){
      errors.messages.should.containEql("password must be present")
      done()
    })
  })

  it("should validate password if email varified property set to false", function(done) {
    var accountParams = { "email": "brock@example.com", "email_verified": false }
    rolodex.account.set(accountParams, function(errors, account){
      errors.messages.should.containEql("password must be present")
      done()
    })
  })

  it("should create account", function(done) {
    rolodex.account.set(validAccountDetails, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("email_verified_at")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      account.should.not.have.property("password")
      done()
    })
  })

  it("should not create account without unique email", function(done) {
    var accountParams = { "email": "brock@sintaxi.com", "email_verified": true }
    rolodex.account.set(accountParams, function(errors, account){
      errors.messages.should.containEql("email already in use")
      errors.details.should.have.property("email", "already in use")
      done()
    })
  })

  // it("should not create account with verified set to false", function(done) {
  //   var accountParams = { "email": "brock@something.com", "email_verified": false }
  //   rolodex.account.set(accountParams, function(errors, account){
  //     errors.messages.should.containEql("email must be verified")
  //     errors.details.should.have.property("email", "must be verified")
  //     done()
  //   })
  // })

  it("should not create account without valid email", function(done) {
    var accountParams = { "email": "brockatsintaxi.com" }
    rolodex.account.set(accountParams, function(errors, account){
      errors.messages.should.containEql("email must be valid")
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

