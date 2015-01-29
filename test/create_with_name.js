var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

describe("create with first and/or last name", function(){
  var rolodex = require("../")(config)

  var validAccountDetails = { 
    "first_name": "Dr. Brock",
    "last_name": "Whitten",
    "email": "brock@sintaxi.com",
    "email_verified": true
  }
  var longname = (function() { var str = '', i = 0; while(i < 65) { i += 1; str += 'a'; } return str; })()

  it("should not create account if first name or last name is longer than 64 characters", function(done) {
    var accountParams = {
      "first_name": longname,
      "last_name": longname,
      "email": "brock@sintaxi.com",
      "email_verified": true
    }
    rolodex.account.set(accountParams, function(errors, account){
      errors.should.have.property("details")
      errors.should.have.property("messages")
      errors.details.should.have.property("first_name", "must be 64 characters or less")
      errors.details.should.have.property("last_name", "must be 64 characters or less")
      errors.messages.should.containEql("first_name must be 64 characters or less")
      errors.messages.should.containEql("last_name must be 64 characters or less")
      done()
    })
  })

  it("should not create account if first name or last name contain invalid characters", function(done) {
    var accountParams = {
      "first_name": "1NV4l1d F1R57 N4M3",
      "last_name": "1NV4L1D l457 n4M3",
      "email": "brock@sintaxi.com",
      "email_verified": true
    }
    rolodex.account.set(accountParams, function(errors, account){
      errors.should.have.property("details")
      errors.should.have.property("messages")
      errors.details.should.have.property("first_name", "must only contain alpha, space and/or period characters")
      errors.details.should.have.property("last_name", "must only contain alpha, space and/or period characters")
      errors.messages.should.containEql("first_name must only contain alpha, space and/or period characters")
      errors.messages.should.containEql("last_name must only contain alpha, space and/or period characters")
      done()
    })
  })

  it("should not create account if first name or last name are empty", function(done) {
    var accountParams = {
      "first_name": "",
      "last_name": "",
      "email": "brock@sintaxi.com",
      "email_verified": true
    }
    rolodex.account.set(accountParams, function(errors, account){
      errors.should.have.property("details")
      errors.should.have.property("messages")
      errors.details.should.have.property("first_name", "must not be empty")
      errors.details.should.have.property("last_name", "must not be empty")
      errors.messages.should.containEql("first_name must not be empty")
      errors.messages.should.containEql("last_name must not be empty")
      done()
    })
  })

  it("should create account with valid params", function(done) {
    rolodex.account.set(validAccountDetails, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("first_name", "Dr. Brock")
      account.should.have.property("last_name", "Whitten")
      account.should.have.property("uuid")
      account.should.have.property("email_verified_at")
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