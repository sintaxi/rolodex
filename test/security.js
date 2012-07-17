var should = require("should")

describe("security", function(){
  var redis = require("redis")
  var client = redis.createClient()
  var rolodex = require("../rolodex")(client)
  
  before(function(done){
    rolodex.account.create({ "email": "brock@sintaxi.com" }, function(errors, account){
      done()
    })
  })

  it("should not be able to change uuid", function(done) {
    rolodex.account.update({ email: "brock@sintaxi.com"}, { "uuid": "12345" }, function(errors, account){
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

