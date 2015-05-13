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
      "email_verified": true
      }, function(errors, account){
     done()
    })
  })

  it("should get validation error when account not in the sytem", function(done) {
   rolodex.account.set({ email: "brock@sintaxi.com" }, { "payment_id": "abc" }, function(errors, account){
     account.should.have.property("payment_id", "abc")
     done()
   })
  })

  after(function(){
   client.flushall()
   client.quit()
  })

})

