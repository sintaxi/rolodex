var should = require("should")

describe("update", function(){
  var redis = require("redis")
  var client = redis.createClient()
  var rolodex = require("../rolodex")(client)
  
  before(function(done){
    rolodex.account.create({ "email": "brock@sintaxi.com" }, function(errors, account){
      global.account_id = account.id
      done()
    })
  })

  it("should be able to change email", function(done) {
    rolodex.account.update({ email: "brock@sintaxi.com" } , { "email": "fred@sintaxi.com" }, function(errors, account){
      account.should.have.property("id", account_id)
      account.should.have.property("email", "fred@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("login_at")
      account.should.have.property("login_count", 0)
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  it("should free up unused email", function(done) {
    var accountParams = { "email": "brock@sintaxi.com" }
    rolodex.account.create(accountParams, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("login_at")
      account.should.have.property("login_count", 0)
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

