var should = require("should")
var client = require("redis").createClient()

describe("group", function(){
  var rolodex = require("../rolodex")()
  var total = 500

  before(function(done){
    var count = 0
    for(var i = 1; i <= total; i++)(function(i){
      var role = Math.floor(Math.random()*6)
      rolodex.account.set({ "email": "user"+ i +"@sintaxi.com", "role": role }, function(errors, account){
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

