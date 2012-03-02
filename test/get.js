var should = require("should")

describe("get", function(){
  var redis = require("redis")
  var client = redis.createClient()
  var rolodex = require("../rolodex")(client)
  
  before(function(done){
    rolodex.account.create({
      "username": "sintaxi",
      "email": "brock@sintaxi.com",
      "password":"foobar"
      }, function(errors, account){
      global.uuid = account.uuid
      done()
    })
  })

  it("should get by id", function(done) {
    rolodex.account.get(1, function(account){
      account.should.have.property("id", 1)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("username", "sintaxi")
      account.should.have.property("uuid")
      account.should.have.property("login_at")
      account.should.have.property("login_count", 0)
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  it("should get by username", function(done) {
    rolodex.account.get({ username: "sintaxi" }, function(account){
      account.should.have.property("id", 1)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("username", "sintaxi")
      account.should.have.property("uuid")
      account.should.have.property("login_at")
      account.should.have.property("login_count", 0)
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })
  
  it("should get by email", function(done) {
    rolodex.account.get({ email: "brock@sintaxi.com" }, function(account){
      account.should.have.property("id", 1)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("username", "sintaxi")
      account.should.have.property("uuid")
      account.should.have.property("login_at")
      account.should.have.property("login_count", 0)
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })
  
  it("should get by UUID", function(done) {
    rolodex.account.get({ uuid: uuid }, function(account){
      account.should.have.property("id", 1)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("username", "sintaxi")
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
