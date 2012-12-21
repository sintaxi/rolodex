var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

describe("group", function(){
  var rolodex = require("../")(config)
  
  var total = 50
  before(function(done){
    rolodex.account.set({ "email": "owner@sintaxi.com", "email_verified": true }, function(errors, account){
      var owner = account.id
      rolodex.account.promote(owner, 0, owner, function(errors, account){
        var count = 0
        for(var i = 1; i <= total; i++)(function(i){
          var role = Math.floor(Math.random() * 6)
          var email = "user"+ i +"@sintaxi.com"
          rolodex.account.set({ "email": email, "email_verified": true }, function(errors, account){
            rolodex.account.promote({ "email": email }, role, owner, function(errors, account){
              count++
              if(count == total){
                done()
              }
            })
          })
        })(i)
      })
    })

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

