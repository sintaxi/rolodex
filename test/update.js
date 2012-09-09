var should = require("should")
var client = require("redis").createClient()

describe("update", function(){
  var rolodex = require("../rolodex")()
  
  before(function(done){
    var validAccountDetails = { 
      "email": "brock@sintaxi.com",
      "email_verified": true
    }
    rolodex.account.set(validAccountDetails, function(errors, account){
      global.account_id = account.id
      done()
    })
  })

  it("should be able to change email", function(done) {
    rolodex.account.set({ email: "brock@sintaxi.com" } , { "email": "fred@sintaxi.com" }, function(errors, account){
      account.should.have.property("id", account_id)
      account.should.have.property("email", "fred@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  it("should free up unused email", function(done) {
    var accountParams = { "email": "brock@sintaxi.com", "email_verified": true }
    rolodex.account.set(accountParams, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

