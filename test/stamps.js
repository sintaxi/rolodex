var fs     = require("fs")
var should = require("should")
var client = require("../lib/client")()

var role   = process.env.ROLE || "master"
var config = JSON.parse(fs.readFileSync(__dirname + "/config/" + role + ".json"))

// facts set once and never cleared: payment_verified stamps
// payment_verified_at, bot records the platform operating the account
// (slushi plans/payment-level.md, plans/grok.md)

describe("stamps", function(){
  var rolodex = require("../")(config)
  var email   = "stamps@sintaxi.com"

  before(function(done){
    rolodex.account.set({
      "email": email,
      "password": "heyo",
      "password_confirmation": "heyo"
    }, function(errors, account){
      should.not.exist(errors)
      done()
    })
  })

  it("should update an unverified account without a password in hand", function(done){
    rolodex.account.set({ email: email }, { first_name: "Unverified" }, function(errors, account){
      should.not.exist(errors)
      account.should.have.property("first_name", "Unverified")
      account.should.have.property("email_verified_at", null)
      done()
    })
  })

  describe("bot", function(){

    it("should start as a person", function(done){
      rolodex.account.get({ email: email }, function(account){
        account.should.not.have.property("bot")
        account.should.not.have.property("bot_at")
        done()
      })
    })

    it("should record the platform and when", function(done){
      rolodex.account.set({ email: email }, { bot: "grok" }, function(errors, account){
        should.not.exist(errors)
        account.should.have.property("bot", "grok")
        account.should.have.property("bot_at")
        should(isNaN(Date.parse(account.bot_at))).be.false()
        account.should.not.have.property("bot_mark")
        done()
      })
    })

    it("should keep the first label and time", function(done){
      rolodex.account.get({ email: email }, function(before){
        rolodex.account.set({ email: email }, { bot: "instinct" }, function(errors, account){
          should.not.exist(errors)
          account.should.have.property("bot", "grok")
          account.should.have.property("bot_at", before.bot_at)
          done()
        })
      })
    })

    it("should survive an unrelated update", function(done){
      rolodex.account.set({ email: email }, { first_name: "Stamp" }, function(errors, account){
        should.not.exist(errors)
        account.should.have.property("bot", "grok")
        done()
      })
    })

    it("should ignore a bot_at written directly", function(done){
      rolodex.account.set({ email: email }, { bot_at: "2000-01-01T00:00:00.000Z" }, function(errors, account){
        should.not.exist(errors)
        account.bot_at.should.not.equal("2000-01-01T00:00:00.000Z")
        done()
      })
    })

    it("should refuse a label that isn't a slug", function(done){
      rolodex.account.set({ email: "fresh-" + email, password: "heyo", password_confirmation: "heyo", bot: "Grok Bot!" }, function(errors, account){
        should.exist(errors)
        should.not.exist(account)
        done()
      })
    })

    it("should label a bot at signup", function(done){
      rolodex.account.set({ email: "bot-" + email, password: "heyo", password_confirmation: "heyo", bot: "grok" }, function(errors, account){
        should.not.exist(errors)
        account.should.have.property("bot", "grok")
        account.should.have.property("bot_at")
        done()
      })
    })
  })

  describe("payment_verified", function(){

    it("should stamp payment_verified_at", function(done){
      rolodex.account.set({ email: email }, { payment_verified: true }, function(errors, account){
        should.not.exist(errors)
        account.should.have.property("payment_verified_at")
        account.should.not.have.property("payment_verified")
        done()
      })
    })

    it("should keep the first stamp", function(done){
      rolodex.account.get({ email: email }, function(before){
        setTimeout(function(){
          rolodex.account.set({ email: email }, { payment_verified: true }, function(errors, account){
            account.should.have.property("payment_verified_at", before.payment_verified_at)
            done()
          })
        }, 5)
      })
    })

    it("should never clear it", function(done){
      rolodex.account.set({ email: email }, { payment_verified: false }, function(errors, account){
        should.not.exist(errors)
        account.should.have.property("payment_verified_at")
        done()
      })
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})
