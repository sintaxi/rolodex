var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var Rolodex = require("../rolodex")
var masterConfig  = JSON.parse(fs.readFileSync(__dirname + "/config/master.json"))
var slaveConfig   = JSON.parse(fs.readFileSync(__dirname + "/config/slave.json"))

describe("update", function(){
  
  var master;
  if(role === "slave"){
    master = Rolodex(masterConfig).listen(5001)
    var config = slaveConfig
  }else{
    var config = masterConfig
  }
  
  //console.log(master)
  
  var rolodex = Rolodex(config)
  var account_id
  before(function(done){
    var validAccountDetails = { 
      "email": "brock@sintaxi.com",
      "email_verified": true
    }
    rolodex.account.set(validAccountDetails, function(errors, account){
      account_id = account.id
      done()
    })
  })

  it("should be able to change email", function(done) {
    rolodex.account.set({ email: "brock@sintaxi.com" } , { "email": "fred@sintaxi.com" }, function(errors, account){
      account.should.have.property("id", account_id)
      account.should.have.property("email", "fred@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  it("should free up unused email", function(done) {
    var accountParams = { "email": "brock@sintaxi.com", "email_verified": true }
    rolodex.account.set(accountParams, function(errors, account){
      account.should.have.property("id")
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  after(function(){
    master.end()
    master.close()
    client.flushall()
    client.quit()
  })

})

