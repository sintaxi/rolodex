var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

describe("create owner", function(){
  var rolodex = require("../")(config)
  
  var account_id
  before(function(done){
    var validAdmintDetails = { 
      "email": "brock@sintaxi.com",
      "email_verified": true
    }
    rolodex.account.set(validAdmintDetails, function(errors, account){
      done()
    })
  })
  
  it("can promote self to owner if only account", function(done) {
    rolodex.account.promote({ "email": "brock@sintaxi.com" }, 0, { "email": "brock@sintaxi.com" }, function(errors, account){
      account.should.have.property("role", 0)
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})