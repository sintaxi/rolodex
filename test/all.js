var should = require("should")

describe("all", function(){
  var redis = require("redis")
  var client = redis.createClient()
  var rolodex = require("../rolodex")(client)
  
  before(function(done){

    var total = 1000
    for(var i = 1; i < total; i++)(function(i){
      rolodex.account.create({
        "email": "user"+ i +"@sintaxi.com",
        "password":"foobar"
        }, function(errors, account){
        if(i == total - 1){
          done()
        }
      })
    })(i)

  })

  it("should get all accounts", function(done) {
    rolodex.account.all(0, -1, function(account){
      account.should.be.an.instanceof(Array)
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

