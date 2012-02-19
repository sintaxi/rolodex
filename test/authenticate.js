var should = require("should")

describe("authenticate", function(){
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

  it("should get validation error with missing username", function(done) {
    rolodex.account.authenticate("batman", "foobaz", function(errors, account){
      errors.fields.should.have.property("username", "is not in the system")
      errors.messages.should.eql(["Username is not in the system"])
      done()
    })
  })

  it("should get validation error wih incorrect password", function(done) {
    rolodex.account.authenticate("sintaxi", "foobaz", function(errors, account){
      errors.fields.should.have.property("password", "is not correct")
      errors.messages.should.eql(["Password is not correct"])
      done()
    })
  })

  it("should return user object on successful authentication", function(done) {
    rolodex.account.authenticate("sintaxi", "foobar", function(errors, account){
      account.should.have.property("id", 1)
      account.should.have.property("email", "brock@sintaxi.com")
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

