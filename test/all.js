var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

describe("all", function(){
  var rolodex = require("../")(config)

  var total = 10
  before(function(done){
    var count = 0
    for(var i = 1; i <= total; i++)(function(i){
      rolodex.account.set({ "email": "user"+ i +"@sintaxi.com", "email_verified": true }, function(errors, account){
        count++
        if(count == total){
          done()
        }
      })
    })(i)
  })

  it("should get all elements with zero args", function(done) {
    rolodex.account.all(function(accounts){
      accounts.should.be.an.instanceof(Array)
      accounts.should.have.lengthOf(total)
      done()
    })
  })

  it("should get all accounts", function(done) {
    rolodex.account.all(0, -1, function(accounts){
      accounts.should.be.an.instanceof(Array)
      accounts.should.have.lengthOf(total)
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

