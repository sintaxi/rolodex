var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()
var config = JSON.parse(fs.readFileSync(__dirname + "/config.json"))

describe("email", function(){
  
  config.email = {
    defaults: { from: "info@chloi.io" }
  }
  
  var rolodex = require("../rolodex")(config)
   
  var validEmail = {
    subject: "Hello", 
    body: "Welcome"
  }

  before(function(done){
    rolodex.account.set({
      "email": "brock@sintaxi.com",
      "email_verified": true
      }, function(errors, account){
     done()
    })
  })

  it("should get validation error when account not in the sytem", function(done) {
   rolodex.account.email({ email: "batman@sintaxi.com" }, {}, function(errors, account){
     errors.details.should.have.property("account", "is not in the system")
     errors.messages.should.eql(["account is not in the system"])
     done()
   })
  })

  it("should get validation error wih incorrect params", function(done) {
   rolodex.account.email({ email: "brock@sintaxi.com" }, {}, function(errors, account){
     errors.details.should.have.property("subject", "must be present")
     errors.details.should.have.property("body", "must be present")
     done()
   })
  })

  it("should return message object if successful", function(done) {
   rolodex.account.email({ email: "brock@sintaxi.com" }, validEmail, function(errors, message){
     message.should.have.property("from", "info@chloi.io")
     message.should.have.property("to", "brock@sintaxi.com")
     message.should.have.property("subject")
     message.should.have.property("body")
     done()
   })
  })

  after(function(){
   client.flushall()
   client.quit()
  })
  
})

