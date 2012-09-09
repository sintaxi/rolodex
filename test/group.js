var should = require("should")
var client = require("redis").createClient()

describe("group", function(){
  var rolodex = require("../rolodex")()
  var total = 500

  before(function(done){
    var count = 0
    for(var i = 1; i <= total; i++)(function(i){
      var role = Math.floor(Math.random() * 6)
      rolodex.account.set({ "email": "user"+ i +"@sintaxi.com", "role": role, "email_verified": true }, function(errors, account){
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
      var count = accounts.length
      var counter = 0

      accounts.forEach(function(a){
        counter ++
        if(counter >= count){
          done()
        }else{
          a.should.have.property("role", 0)
        }
      })
    })
  })

  it("should get all group 1 accounts", function(done) {
    rolodex.account.group(1, function(accounts){
      accounts.should.be.an.instanceof(Array)
      var count = accounts.length
      var counter = 0

      accounts.forEach(function(a){
        counter ++
        if(counter >= count){
          done()
        }else{
          a.should.have.property("role", 1)
        }
      })
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

