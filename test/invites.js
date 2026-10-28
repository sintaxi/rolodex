var fs     = require("fs")
var crypto = require("crypto")
var should = require("should")
var client = require("../lib/client")()

var role   = process.env.ROLE || "master"
var config = JSON.parse(fs.readFileSync(__dirname + "/config/" + role + ".json"))

// org invites (slushi plans/b2b.md, decided 2026-10-28): an invite is an
// anonymous code, joined by whichever account holds it - Surge never
// emails it. Codes are single-use and expire, several live at once up to
// the caller's limit. Only members count against the cap: a full org
// takes no invites, and refuses a join without spending its code

describe("invites", function(){
  var rolodex = require("../")(config)
  var admin, sally, other, org

  var account = function(email, done){
    rolodex.account.set({ email: email, password: "heyo", password_confirmation: "heyo" }, function(errors, a){
      should.not.exist(errors)
      done(a)
    })
  }

  // unique per run: a run killed mid-way can leave its codes behind
  var run = Date.now().toString(36), n = 0
  var mint = function(id, role, opts, done){
    opts = Object.assign({ code: "tiger" + run + (n++), hint: "tiger", by: admin.id }, opts)
    rolodex.org.invite(id, role, opts, function(errors, invite){
      should.not.exist(errors, JSON.stringify(errors))
      done(invite)
    })
  }

  before(function(done){
    account("fred@invites.test", function(a){
      admin = a
      account("sally@invites.test", function(b){
        sally = b
        account("other@invites.test", function(d){
          other = d
          rolodex.org.create({ slug: "invites-acme", name: "Acme", admin: admin.id }, function(errors, record){
            should.not.exist(errors)
            org = record
            done()
          })
        })
      })
    })
  })

  it("mints a code in the caller's shape and lists it by its hint", function(done){
    rolodex.org.invite(org.id, "member", { code: "tiger73azqrk", hint: "tiger", by: admin.id, cap: 3 }, function(errors, invite){
      should.not.exist(errors)
      invite.code.should.equal("tiger73azqrk")
      invite.role.should.equal("member")
      should.exist(invite.expires_at)
      rolodex.org.invites(org.id, function(errors, list){
        list.should.have.lengthOf(1)
        list[0].should.have.properties({ hint: "tiger", role: "member", by: admin.id })
        list[0].should.not.have.property("email")
        JSON.stringify(list).should.not.containEql("tiger73azqrk")
        done()
      })
    })
  })

  it("draws its own code when the caller doesn't", function(done){
    rolodex.org.invite(org.id, "member", function(errors, invite){
      invite.code.should.match(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)
      rolodex.org.scrap(invite.code, function(errors){
        should.not.exist(errors)
        done()
      })
    })
  })

  it("refuses a code that's already live", function(done){
    rolodex.org.invite(org.id, "member", { code: "tiger73azqrk" }, function(errors){
      errors.details.should.have.property("code", "is taken, try another")
      done()
    })
  })

  it("joins any account with any case and spacing, once", function(done){
    rolodex.org.inviteOrg("Tiger 73 AZQRK", function(id){
      id.should.equal(org.id)
      rolodex.org.join("Tiger 73 AZQRK", sally.id, { cap: 3 }, function(errors, joined){
        should.not.exist(errors)
        joined.org.id.should.equal(org.id)
        joined.role.should.equal("member")
        joined.already.should.equal(false)
        rolodex.org.join("tiger73azqrk", other.id, function(errors){
          errors.details.should.have.property("invite", "is not valid")
          rolodex.org.invited(org.id, function(errors, invited){
            invited.should.not.have.property(sally.id, "an anonymous code records no email")
            done()
          })
        })
      })
    })
  })

  it("describes a live code without spending it", function(done){
    mint(org.id, "admin", {}, function(invite){
      rolodex.org.inviteInfo(invite.code.toUpperCase(), function(info){
        info.should.have.properties({ org: org.id, role: "admin", by: admin.id })
        should.exist(info.expires_at)
        rolodex.org.inviteInfo("nope00zzzzz", function(none){
          should.not.exist(none)
          rolodex.org.scrap(invite.code, function(errors){
            should.not.exist(errors, "still live after being described")
            rolodex.org.inviteInfo(invite.code, function(gone){
              should.not.exist(gone)
              done()
            })
          })
        })
      })
    })
  })

  it("keeps several live at once, up to the limit", function(done){
    mint(org.id, "member", { most: 3 }, function(){
      mint(org.id, "admin", { most: 3 }, function(){
        mint(org.id, "member", { most: 3 }, function(){
          rolodex.org.invite(org.id, "member", { code: "spare11aaaaa", most: 3 }, function(errors){
            errors.details.should.have.property("invites", "org has reached its limit of pending invites")
            rolodex.org.invites(org.id, function(errors, list){
              list.should.have.lengthOf(3)
              list.map(function(i){ return i.role }).sort().should.eql(["admin", "member", "member"])
              done()
            })
          })
        })
      })
    })
  })

  it("scraps a code: it stops working and leaves the list", function(done){
    rolodex.org.invites(org.id, function(errors, before){
      mint(org.id, "member", {}, function(invite){
        rolodex.org.scrap(invite.code.toUpperCase(), { org: org.id }, function(errors, id){
          should.not.exist(errors)
          id.should.equal(org.id)
          rolodex.org.join(invite.code, other.id, function(errors){
            errors.details.should.have.property("invite", "is not valid")
            rolodex.org.invites(org.id, function(errors, after){
              after.should.have.lengthOf(before.length)
              rolodex.org.scrap(invite.code, function(errors){
                errors.details.should.have.property("invite", "is not valid")
                done()
              })
            })
          })
        })
      })
    })
  })

  it("won't scrap or join a code named against another org", function(done){
    rolodex.org.create({ slug: "invites-elsewhere", name: "Elsewhere", admin: other.id }, function(errors, elsewhere){
      mint(org.id, "member", {}, function(invite){
        rolodex.org.scrap(invite.code, { org: elsewhere.id }, function(errors){
          errors.details.should.have.property("invite", "is not valid")
          rolodex.org.join(invite.code, other.id, { org: elsewhere.id }, function(errors){
            errors.details.should.have.property("invite", "is not valid")
            rolodex.org.join(invite.code, other.id, { org: org.id }, function(errors, joined){
              should.not.exist(errors, "still good for the org it's for")
              joined.org.id.should.equal(org.id)
              rolodex.org.removeMember(org.id, other.id, function(errors){
                should.not.exist(errors)
                done()
              })
            })
          })
        })
      })
    })
  })

  it("counts members against the cap, not invites", function(done){
    // fred and sally are in: a cap of 2 is full
    rolodex.org.invite(org.id, "member", { code: "full22aaaaa", cap: 2 }, function(errors){
      should.exist(errors, "a full org takes no invites")
      errors.details.should.have.property("members")
      rolodex.org.invites(org.id, function(errors, list){
        var live = list.length
        mint(org.id, "member", { cap: 3 }, function(invite){
          rolodex.org.join(invite.code, other.id, { cap: 2 }, function(errors){
            should.exist(errors, "nor joins")
            errors.details.should.have.property("members")
            rolodex.org.join(invite.code, other.id, { cap: 3 }, function(errors, joined){
              should.not.exist(errors, "a refused join leaves the code good for when a seat frees up")
              rolodex.org.removeMember(org.id, other.id, function(){ done() })
            })
          })
        })
      })
    })
  })

  it("still joins, lists and scraps an email invite from before", function(done){
    // the shape invites had until 2026-10-28, keyed by the email it went to
    var code = "abcd-efgh-jkmn-pqrs"
    var key = crypto.createHash("sha256").update("abcdefghjkmnpqrs").digest("hex")
    var t = Date.now()
    client.hset("org:" + org.id + ":invites", "old@invites.test", JSON.stringify({ key: key, role: "member", by: admin.id, created_at: new Date(t).toJSON(), expires_at: t + 60000 }), function(){
      client.set("org:invite:" + key, org.id, function(){
        rolodex.org.invites(org.id, function(errors, list){
          var old = list.filter(function(i){ return i.email === "old@invites.test" })[0]
          should.exist(old)
          rolodex.org.join(code, other.id, { cap: 3 }, function(errors, joined){
            should.not.exist(errors)
            joined.role.should.equal("member")
            rolodex.org.invited(org.id, function(errors, invited){
              invited.should.have.property(other.id, "old@invites.test")
              rolodex.org.removeMember(org.id, other.id, function(){ done() })
            })
          })
        })
      })
    })
  })

  it("lets an invite expire: it neither joins nor lists", function(done){
    var short = require("../models/org")({ client: client, inviteTtl: 1 })
    short.invite(org.id, "member", { code: "late99zzzzz", hint: "late", cap: 3 }, function(errors, invite){
      should.not.exist(errors)
      setTimeout(function(){
        short.join(invite.code, other.id, function(errors){
          should.exist(errors)
          rolodex.org.invites(org.id, function(errors, list){
            list.map(function(i){ return i.hint }).should.not.containEql("late")
            done()
          })
        })
      }, 1100)
    })
  })

  it("refuses an invite that isn't to a role", function(done){
    rolodex.org.invite(org.id, "owner", function(errors){
      errors.details.should.have.property("role")
      done()
    })
  })

  it("stops an org's codes when it is deleted", function(done){
    rolodex.org.create({ slug: "invites-gone", name: "Gone", admin: admin.id }, function(errors, gone){
      mint(gone.id, "member", {}, function(invite){
        rolodex.org.del(gone.id, function(errors){
          should.not.exist(errors)
          rolodex.org.join(invite.code, other.id, function(errors){
            should.exist(errors)
            errors.details.should.have.property("invite", "is not valid")
            done()
          })
        })
      })
    })
  })

  after(function(){
    client.flushall()
  })

})
