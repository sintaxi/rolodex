var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))


describe("payment", function(){
  var rolodex = require("../")(config)

  before(function(done){
    rolodex.account.set({
      "email": "brock@sintaxi.com",
      "password": "heyo",
      "password_confirmation": "heyo"
      }, function(errors, account){
     done()
    })
  })

  it("should be able to set payment_id", function(done) {
   rolodex.account.set({ email: "brock@sintaxi.com" }, { "payment_id": "abc", "email_verified": false }, function(errors, account){
     account.should.have.property("payment_id", "abc")
     done()
   })
  })

  after(function(){
   client.flushall()
   client.quit()
  })

})

