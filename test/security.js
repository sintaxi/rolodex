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

  it("should not be able to change uuid", function(done) {
    rolodex.account.set({ email: "brock@sintaxi.com"}, { "uuid": "12345" }, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("uuid")
      account.uuid.should.not.eql("12345")
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

