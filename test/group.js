var should = require("should")

describe("all", function(){
  var redis = require("redis")
  var client = redis.createClient()
  var rolodex = require("../rolodex")(client)
  var total = 100

  before(function(done){
    var count = 0
    for(var i = 1; i <= total; i++)(function(i){
      var role = Math.floor(Math.random()*6)
      rolodex.account.create({
        "email": "user"+ i +"@sintaxi.com",
        "password":"foobar",
        "role": role,
        }, function(errors, account){
        count++
        if(count == total){
          done()
        }
      })
    })(i)

  })

  it("should get all group 5 accounts", function(done) {
    rolodex.account.group(0, function(accounts){
      accounts.should.be.an.instanceof(Array)
      done()
    })
  })

  after(function(){
    console.log("\nGet completed in " +  ((end_time - start_time ) / 1000) + " seconds\n")
    client.flushall()
    client.quit()
  })

})

