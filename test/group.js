var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var Rolodex = require("../rolodex")
var masterConfig  = JSON.parse(fs.readFileSync(__dirname + "/config/master.json"))
var slaveConfig   = JSON.parse(fs.readFileSync(__dirname + "/config/slave.json"))

if(role === "slave"){
  Rolodex(masterConfig).listen(5001)
  var config = slaveConfig
}else{
  var config = masterConfig
}

describe("group", function(){
  var rolodex = Rolodex(config)
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

