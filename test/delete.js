var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))


describe("delete", function(){
  var rolodex = require("../")(config)
  var account_id, uuid
  before(function(done){
    var validAccountDetails = {
      "email": "foo@sintaxi.com",
      "email_verified": true
    }
    rolodex.account.set(validAccountDetails, function(errors, account){
      done()
    })
  })

  it("should be able to delete account", function(done) {
    rolodex.account.del({ email: "foo@sintaxi.com" }, function(errors){
      should.not.exist(errors)
      rolodex.account.get({ email: "foo@sintaxi.com" }, function(account){
        should.not.exist(account)
        done()  
      })
    })
  })
  
  it("should no longer be in system", function(done) {
    rolodex.account.all(function(accounts){
      accounts.should.be.an.instanceof(Array)
      accounts.should.have.lengthOf(0)
      done()
    })
  })
  
  it("should no longer be in system", function(done) {
    rolodex.account.group(5, function(accounts){
      accounts.should.be.an.instanceof(Array)
      accounts.should.have.lengthOf(0)
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})
