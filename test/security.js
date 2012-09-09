var should = require("should")
var client = require("redis").createClient()

describe("security", function(){
  var rolodex = require("../rolodex")()
  
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

