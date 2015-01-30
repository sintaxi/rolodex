var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))


describe("global_email", function(){
  var rolodex = require("../")(config)

  before(function(done){
    done()
  })

  it("should err missind paramsystem", function(done) {
    rolodex.email({
      subject: "Hello",
      body: "Welcome",
      body_html: "<b>Welcome</b>"
    }, function(errors, status) {
      errors.should.exist
      errors.details.should.have.property("to")
      done()
    })
  })

  it("should send a email from the system", function(done) {
    rolodex.email({
      email: "rob@silentrob.me",
      subject: "Hello",
      body: "Welcome",
      body_html: "<b>Welcome</b>"
    }, function(errors, status) {
    should.not.exist(errors)
      done()
    })
  })

  after(function(){
   client.flushall()
   client.quit()
  })

})
