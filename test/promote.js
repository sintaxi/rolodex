var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

describe("promote", function(){
  var rolodex = require("../")(config)
  
  var account_id
  before(function(done){
    var validAdmintDetails = { 
      "email": "brock@sintaxi.com",
      "email_verified": true
    }
    var validAccountDetails = { 
      "email": "dave@sintaxi.com",
      "email_verified": true
    }
    rolodex.account.set(validAdmintDetails, function(errors, account){
      account_id = account.id
      client.hset("account:" + account_id, "role", 2, function(err, reply){
        rolodex.account.set(validAccountDetails, function(errors, account){
          done()  
        })
      })
    })
  })
  
  it("should have account", function(done) {
    rolodex.account.promote({ "email": "janedoe@sintaxi.com" }, 3, { "email": "janedoe@sintaxi.com" }, function(errors, account){
      errors.details.should.have.property("account", "must exist")
      done()
    })
  })
  
  it("should have promoter", function(done) {
    rolodex.account.promote({ "email": "dave@sintaxi.com" }, 3, { "email": "janedoe@sintaxi.com" }, function(errors, account){
      errors.details.should.have.property("promoter", "must exist")
      done()
    })
  })
  
  it("should not be able to promote to higher level", function(done) {
    rolodex.account.promote({ "email": "dave@sintaxi.com" }, 0, { "email": "brock@sintaxi.com" }, function(errors, account){
      errors.details.should.have.property("role", "cannot be higher than promoter")
      done()
    })
  })
  
  it("should not be able to change role of someone with higher role", function(done) {
    rolodex.account.promote({ "email": "brock@sintaxi.com" }, 5, { "email": "dave@sintaxi.com" }, function(errors, account){
      errors.details.should.have.property("promoter", "does not have high enough role")
      done()
    })
  })
  
  it("should be able to promote someone", function(done) {
    rolodex.account.promote({ "email": "dave@sintaxi.com" }, 3, { "email": "brock@sintaxi.com" }, function(errors, account){
      account.should.have.property("role", 3)
      done()
    })
  })
  
  it("should not allow role to be lower than 5", function(done) {
    rolodex.account.promote({ "email": "dave@sintaxi.com" }, 7, { "email": "brock@sintaxi.com" }, function(errors, account){
      account.should.have.property("role", 5)
      done()
    })
  })
  
  it("should not allow self promotion", function(done) {
    rolodex.account.promote({ "email": "dave@sintaxi.com" }, 4, { "email": "dave@sintaxi.com" }, function(errors, account){
      errors.details.should.have.property("promoter", "cannot be same as account")
      done()
    })
  })
  
  it("cant promote self to owner more than one acount in system", function(done) {
    rolodex.account.promote({ "email": "brock@sintaxi.com" }, 0, { "email": "brock@sintaxi.com" }, function(errors, account){
      errors.details.should.have.property("promoter", "cannot be same as account")
      errors.details.should.have.property("role", "cannot be higher than promoter")
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

