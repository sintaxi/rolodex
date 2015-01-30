var fs     = require("fs")
var should = require("should")
var client = require("redis").createClient()

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))


describe("global_email", function(){
  var rolodex = require("../")(config)

  var validEmail = {
    email: "rob@silentrob.me",
    subject: "Hello",
    body: "Welcome",
    body_html: "<b>Welcome</b>"
  }


  var inValidEmail = {
    subject: "Hello",
    body: "Welcome",
    body_html: "<b>Welcome</b>"
  }

  before(function(done){
    done()
  });


  it("should err missind paramsystem", function(done) {
    rolodex.email(inValidEmail, function(errors, status) {
      errors.should.exist;
      done();
   });
  });

  it("should send a email from the system", function(done) {
   rolodex.email(validEmail, function(errors, status) {
    should.not.exist(errors)
     done();
   });
  });
  
  after(function(){
   client.flushall();
   client.quit();
  });

});
