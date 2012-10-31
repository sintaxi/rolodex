var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

describe("security", function(){
  var rolodex = require("../")(config)
  
  before(function(done){
    var validAccountDetails = { 
      "email": "brock@sintaxi.com",
      "email_verified": true
    }
    rolodex.account.set(validAccountDetails, function(errors, account){
      done()
    })
  })

  it("should not be able to change id", function(done) {
    rolodex.account.set({ email: "brock@sintaxi.com"}, { id: "567" }, function(errors, account){
      account.should.have.property("id")
      account.id.should.not.eql("567")
      done()
    })
  })
  
  it("should not take arbitrary values id", function(done) {
    rolodex.account.set({ email: "brock@sintaxi.com"}, { id: "567", foo: "bar" }, function(errors, account){
      account.should.not.have.property("foo")
      done()
    })
  })
  
  it("should not be able to set role", function(done) {
    rolodex.account.set({ email: "someguy@sintaxi.com", "email_verified": true, "role": 3}, function(errors, account){
      account.should.have.property("role", 5)
      done()
    })
  })
  
  it("should not be able to update role", function(done) {
    rolodex.account.set({ email: "someguy@sintaxi.com" }, { "role": 3 }, function(errors, account){
      account.should.have.property("role", 5)
      done()
    })
  })

  it("should not be able to change uuid", function(done) {
    rolodex.account.set({ email: "brock@sintaxi.com"}, { "uuid": "12345" }, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("uuid")
      account.uuid.should.not.eql("12345")
      done()
    })
  })

  it("should return hash, password, password_confirmation propertied", function(done) {
    rolodex.account.get({ email: "brock@sintaxi.com"}, function(account){
      account.should.not.have.property("hash")
      account.should.not.have.property("password")
      account.should.not.have.property("password_confirmation")
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

