var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

describe("authenticate", function(){
  var rolodex = require("../")(config)

   before(function(done){
     rolodex.account.set({
       "email": "brock@sintaxi.com",
       "password":"foobar",
       "password_confirmation":"foobar"
       }, function(errors, account){
       done()
     })
   })

   it("should get validation error when account not in the sytem", function(done) {
     rolodex.account.authenticate({ email: "batman@sintaxi.com" }, "foobar", function(errors, account){
       errors.details.should.have.property("account", "is not in the system")
       errors.messages.should.eql(["account is not in the system"])
       done()
     })
   })

   it("should get validation error wih incorrect password", function(done) {
     rolodex.account.authenticate({ email: "brock@sintaxi.com" }, "foobaz", function(errors, account){
       errors.details.should.have.property("password", "is not correct")
       errors.messages.should.eql(["password is not correct"])
       done()
     })
   })

   it("should return user object on successful authentication", function(done) {
     rolodex.account.authenticate({ email: "brock@sintaxi.com" }, "foobar", function(errors, account){
       account.should.have.property("id")
       account.should.have.property("email", "brock@sintaxi.com")
       account.should.have.property("uuid")
       account.should.have.property("created_at")
       account.should.have.property("updated_at")
       done()
     })
   })

  it("should expect token authentication when single argument", function(done) {
     rolodex.account.authenticate("someinvalidtoken", function(errors, account){
       errors.details.should.have.property("token", "is not valid")
       errors.messages.should.eql(["token is not valid"])
       done()
     })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

