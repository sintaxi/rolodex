var should = require("should")

describe("group", function(){
  var redis = require("redis")
  var client = redis.createClient()
  var rolodex = require("../rolodex")(client)
  var total = 500

  before(function(done){
    var count = 0
    for(var i = 1; i <= total; i++)(function(i){
      var role = Math.floor(Math.random()*6)
      rolodex.account.create({ "email": "user"+ i +"@sintaxi.com", "role": role }, function(errors, account){
        count++
        if(count == total){
          done()
        }
      })
    })(i)

  })

  it("should get all group 0 accounts", function(done) {
    rolodex.account.group(0, function(accounts){
      accounts.should.be.an.instanceof(Array)
      //accounts.forEach(function(a){
      //  a.should.have.property("role", 0)
      //})
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

