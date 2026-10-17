var fs     = require("fs")
var should = require("should")
var client = require("../lib/client")()

var role   = process.env.ROLE || "master"
var config = JSON.parse(fs.readFileSync(__dirname + "/config/" + role + ".json"))

// one address is one identity whatever its capitals (slushi
// plans/email-case.md): new accounts are stored trimmed and lowercase, and
// a lookup tries the address as given, then its normal form. Records
// written before 0.20.0 keep their capitals and keep answering as before.
describe("email case", function(){
  var rolodex = require("../")(config)

  // an account as older releases stored it: capitals in the field and the key
  var legacy = function(email, cb){
    rolodex.account.set({ email: "tmp-" + Date.now() + Math.random() + "@example.com", email_verified: true }, function(errors, account){
      should.not.exist(errors)
      client.multi()
        .del("account:email:" + account.email)
        .hset("account:" + account.id, "email", email)
        .set("account:email:" + email, account.id)
        .exec(function(){ cb(account.id) })
    })
  }

  before(function(done){ client.flushall(function(){ done() }) })

  it("stores a new address trimmed and lowercase", function(done){
    rolodex.account.set({ email: "  Mixed@Case.COM ", password: "secret", password_confirmation: "secret" }, function(errors, account){
      should.not.exist(errors)
      account.should.have.property("email", "mixed@case.com")
      client.get("account:email:mixed@case.com", function(err, id){
        id.should.equal(account.id)
        done()
      })
    })
  })

  it("finds it whatever the capitals", function(done){
    rolodex.account.get({ email: "MIXED@case.com" }, function(account){
      account.should.have.property("email", "mixed@case.com")
      done()
    })
  })

  it("refuses the same address in other capitals", function(done){
    rolodex.account.set({ email: "Mixed@CASE.com", password: "secret", password_confirmation: "secret" }, function(errors, account){
      errors.should.have.property("details")
      errors.details.should.have.property("email", "already in use")
      done()
    })
  })

  it("authenticates whatever the capitals", function(done){
    rolodex.account.authenticate({ email: "Mixed@Case.com" }, "secret", function(err, account){
      should.not.exist(err)
      account.should.have.property("email", "mixed@case.com")
      done()
    })
  })

  it("still finds an older capitalized record as given", function(done){
    legacy("Older@Example.org", function(id){
      rolodex.account.get({ email: "Older@Example.org" }, function(account){
        account.should.have.property("id", id)
        account.should.have.property("email", "Older@Example.org")
        done()
      })
    })
  })

  it("leaves an older record's address alone on an unrelated update", function(done){
    rolodex.account.get({ email: "Older@Example.org" }, function(account){
      rolodex.account.set(account.id, { payment_id: "cus_test" }, function(errors, updated){
        should.not.exist(errors)
        updated.should.have.property("email", "Older@Example.org")
        updated.should.have.property("payment_id", "cus_test")
        client.get("account:email:Older@Example.org", function(err, id){
          id.should.equal(account.id)
          done()
        })
      })
    })
  })

  describe("a pair that differs only by case", function(){
    var lowerId, upperId

    before(function(done){
      rolodex.account.set({ email: "phil@pair.example", email_verified: true }, function(errors, account){
        lowerId = account.id
        legacy("Phil@pair.example", function(id){
          upperId = id
          done()
        })
      })
    })

    it("answers each spelling with its own account", function(done){
      rolodex.account.get({ email: "phil@pair.example" }, function(a){
        a.id.should.equal(lowerId)
        rolodex.account.get({ email: "Phil@pair.example" }, function(b){
          b.id.should.equal(upperId)
          done()
        })
      })
    })

    it("sends a third spelling to the lowercase account instead of nobody", function(done){
      rolodex.account.get({ email: "PHIL@pair.example" }, function(a){
        a.id.should.equal(lowerId)
        done()
      })
    })

    it("still lets the capitalized twin be updated", function(done){
      rolodex.account.set(upperId, { first_name: "Phil" }, function(errors, updated){
        should.not.exist(errors)
        updated.should.have.property("email", "Phil@pair.example")
        done()
      })
    })
  })

  after(function(){ client.flushall() })
})
