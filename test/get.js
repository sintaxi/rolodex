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

describe("get", function(){
  var rolodex = Rolodex(config)
  var account_id, uuid
  
  before(function(done){
    var validAccountDetails = { 
      "email": "brock@sintaxi.com",
      "email_verified": true
    }

    rolodex.account.set(validAccountDetails, function(errors, account){
      account_id = account.id
      uuid = account.uuid
      done()
    })
  })

  it("should get by id", function(done) {
    rolodex.account.get(account_id, function(account){
      account.should.have.property("id", account_id)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      account.should.not.have.property("hash")
      account.should.not.have.property("password")
      account.should.not.have.property("password_confirmation")
      done()
    })
  })

  it("should get by email", function(done) {
    rolodex.account.get({ email: "brock@sintaxi.com" }, function(account){
      account.should.have.property("id", account_id)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("uuid")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      account.should.not.have.property("hash")
      account.should.not.have.property("password")
      account.should.not.have.property("password_confirmation")
      done()
    })
  })
  
  it("should get by UUID", function(done) {
    rolodex.account.get({ uuid: uuid }, function(account){
      account.should.have.property("id", account_id)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  it("should return null if not present", function(done) {
    rolodex.account.get(99, function(account){
      should.not.exist(account)
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})
