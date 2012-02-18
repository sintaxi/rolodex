var should = require("should")

describe("update", function(){
  var redis = require("redis")
  var client = redis.createClient()
  var rolodex = require("../rolodex")(client)
  
  before(function(done){
    rolodex.account.create({
      "username": "sintaxi",
      "email": "brock@sintaxi.com",
      "password":"foobar"
      }, function(errors, account){
      done()
    })
  })

  it("should be able to change username", function(done) {
    rolodex.account.update(1, { "username": "brock" }, function(errors, account){
      account.should.have.property("id", 1)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("username", "brock")
      account.should.have.property("uuid")
      account.should.have.property("hash")
      account.should.have.property("login_at")
      account.should.have.property("login_count")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  it("should free up unused username", function(done) {
    var accountParams = {
      "username": "sintaxi",
      "email": "sintaxi@example.com",
      "password":"foobar"
    }
    rolodex.account.create(accountParams, function(errors, account){
      account.should.have.property("id", 2)
      account.should.have.property("email", "sintaxi@example.com")
      account.should.have.property("username", "sintaxi")
      account.should.have.property("uuid")
      account.should.have.property("hash")
      account.should.have.property("login_at")
      account.should.have.property("login_count")
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

