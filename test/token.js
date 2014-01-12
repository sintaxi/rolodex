var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))


describe("token", function(){
  var rolodex = require("../")(config)

  var tk;
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

  it("should be able to create access token", function(done) {
    rolodex.account.token({"email":"brock@sintaxi.com"}, function(errors, token){
      tk = token
      should.not.exist(errors)
      should.exist(token)
      token.should.be.type('string')
      done()
    })
  })

  it("should be able to use token to fetch user", function(done) {
    rolodex.account.authenticate(tk, function(errors, account){
      account.should.have.property("id", account_id)
      account.should.have.property("email", "brock@sintaxi.com")
      account.should.have.property("created_at")
      account.should.have.property("updated_at")
      done()
    })
  })

  it("should require auth and give token", function(done) {
    rolodex.account.authtoken(tk, function(errors, token){
      should.not.exist(errors)
      should.exist(token)
      token.should.be.type('string')
      done()
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})

