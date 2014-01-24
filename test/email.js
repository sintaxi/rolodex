var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))


describe("email", function(){
  var rolodex = require("../")(config)

  var validEmail = {
    subject: "Hello",
    body: "Welcome",
    body_html: "<b>Welcome</b>"
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
   rolodex.account.email({ email: "batman@sintaxi.com" }, validEmail, function(errors, account){
     errors.details.should.have.property("to", "must be present")
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
     message.should.have.property("from")
     message.should.have.property("to")
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

