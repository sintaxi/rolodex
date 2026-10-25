var fs     = require("fs")
var should = require("should")
var client = require("../lib/client")()

var role   = process.env.ROLE || "master"
var config = JSON.parse(fs.readFileSync(__dirname + "/config/" + role + ".json"))

// org invites (slushi plans/b2b.md, decided 2026-10-25): an invite goes to
// an email and is joined by whichever account holds its code. Codes are
// single-use and expire. Only members count against the cap: a full org
// takes no invites, and refuses a join without spending its code

describe("invites", function(){
  var rolodex = require("../")(config)
  var admin, sally, sallyWork, other, org

  var account = function(email, done){
    rolodex.account.set({ email: email, password: "heyo", password_confirmation: "heyo" }, function(errors, a){
      should.not.exist(errors)
      done(a)
    })
  }

  before(function(done){
    account("fred@invites.test", function(a){
      admin = a
      account("sally@invites.test", function(b){
        sally = b
        account("sally@work.invites.test", function(c){
          sallyWork = c
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
  })

  it("invites an email and hands back the code once", function(done){
    rolodex.org.invite(org.id, " Sally@Invites.TEST ", "member", { by: admin.id, cap: 3 }, function(errors, invite){
      should.not.exist(errors)
      invite.email.should.equal("sally@invites.test")
      invite.role.should.equal("member")
      invite.code.should.match(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)
      should.exist(invite.expires_at)
      rolodex.org.invites(org.id, function(errors, list){
        list.length.should.equal(1)
        list[0].email.should.equal("sally@invites.test")
        list[0].by.should.equal(admin.id)
        should.not.exist(list[0].code)
        should.not.exist(list[0].key)
        done()
      })
    })
  })

  it("counts members against the cap, not invites", function(done){
    rolodex.org.invite(org.id, "third@invites.test", "member", { cap: 2 }, function(errors, third){
      should.not.exist(errors, "the pending invite to sally holds no seat")
      rolodex.org.setMember(org.id, other.id, "member", { cap: 2 }, function(errors){
        should.not.exist(errors, "nor do two of them")
        rolodex.org.invite(org.id, "fourth@invites.test", "member", { cap: 2 }, function(errors){
          should.exist(errors, "a full org takes no invites")
          errors.details.should.have.property("members", "org has reached its member limit")
          rolodex.org.join(third.code, sally.id, { cap: 2 }, function(errors){
            should.exist(errors, "nor joins")
            errors.details.should.have.property("members", "org has reached its member limit")
            rolodex.org.removeMember(org.id, other.id, function(errors){
              should.not.exist(errors)
              rolodex.org.join(third.code, other.id, { cap: 2 }, function(errors, joined){
                should.not.exist(errors, "a refused join leaves the code good for when a seat frees up")
                joined.org.id.should.equal(org.id)
                rolodex.org.removeMember(org.id, other.id, done)
              })
            })
          })
        })
      })
    })
  })

  it("lets a re-invite's new code work and the old one stop", function(done){
    rolodex.org.invite(org.id, "sally@invites.test", "member", { cap: 3 }, function(errors, first){
      rolodex.org.invite(org.id, "sally@invites.test", "member", { cap: 3 }, function(errors, second){
        rolodex.org.join(first.code, other.id, function(errors){
          should.exist(errors)
          errors.details.should.have.property("invite", "is not valid")
          rolodex.org.join(second.code.toUpperCase().replace(/-/g, ""), sallyWork.id, function(errors, joined){
            should.not.exist(errors, "case and dashes don't matter")
            joined.org.id.should.equal(org.id)
            joined.role.should.equal("member")
            joined.already.should.equal(false)
            done()
          })
        })
      })
    })
  })

  it("joins under any account and remembers where the invite went", function(done){
    rolodex.org.members(org.id, function(errors, members){
      members.should.have.property(sallyWork.id, "member")
      members.should.not.have.property(sally.id)
      rolodex.org.invited(org.id, function(errors, invited){
        invited.should.have.property(sallyWork.id, "sally@invites.test")
        rolodex.org.ofAccount(sallyWork.id, function(errors, orgs){
          orgs.map(function(o){ return o.id }).should.eql([org.id])
          rolodex.org.invites(org.id, function(errors, list){
            list.should.eql([])
            done()
          })
        })
      })
    })
  })

  it("refuses inviting an email that is already a member's", function(done){
    rolodex.org.invite(org.id, "sally@work.invites.test", "member", { cap: 3 }, function(errors){
      should.exist(errors)
      errors.details.should.have.property("email", "is already a member")
      done()
    })
  })

  it("spends a code an existing member uses, changing nothing", function(done){
    rolodex.org.invite(org.id, "again@invites.test", "admin", { cap: 3 }, function(errors, invite){
      should.not.exist(errors)
      rolodex.org.join(invite.code, sallyWork.id, function(errors, joined){
        should.not.exist(errors)
        joined.already.should.equal(true)
        joined.role.should.equal("member")
        rolodex.org.join(invite.code, other.id, function(errors){
          should.exist(errors, "single-use")
          rolodex.org.invites(org.id, function(errors, list){
            list.should.eql([])
            done()
          })
        })
      })
    })
  })

  it("refuses a code named against another org, without spending it", function(done){
    rolodex.org.create({ slug: "invites-elsewhere", name: "Elsewhere", admin: other.id }, function(errors, elsewhere){
      rolodex.org.invite(org.id, "named@invites.test", "member", { cap: 3 }, function(errors, invite){
        rolodex.org.join(invite.code, other.id, { org: elsewhere.id }, function(errors){
          should.exist(errors)
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

  it("changes a pending invite's role, and withdraws it", function(done){
    rolodex.org.invite(org.id, "pending@invites.test", "member", { cap: 3 }, function(errors, invite){
      rolodex.org.inviteRole(org.id, "pending@invites.test", "admin", function(errors){
        should.not.exist(errors)
        rolodex.org.invites(org.id, function(errors, list){
          list[0].role.should.equal("admin")
          rolodex.org.uninvite(org.id, "Pending@Invites.test", function(errors){
            should.not.exist(errors)
            rolodex.org.join(invite.code, other.id, function(errors){
              should.exist(errors, "a withdrawn invite's code stops working")
              rolodex.org.uninvite(org.id, "pending@invites.test", function(errors){
                errors.details.should.have.property("invite", "is not valid")
                done()
              })
            })
          })
        })
      })
    })
  })

  it("lets an invite expire: it neither joins nor lists", function(done){
    var short = require("../models/org")({ client: client, inviteTtl: 1 })
    short.invite(org.id, "late@invites.test", "member", { cap: 3 }, function(errors, invite){
      should.not.exist(errors)
      setTimeout(function(){
        short.join(invite.code, other.id, function(errors){
          should.exist(errors)
          rolodex.org.invites(org.id, function(errors, list){
            list.map(function(i){ return i.email }).should.not.containEql("late@invites.test")
            done()
          })
        })
      }, 1100)
    })
  })

  it("refuses an invite that isn't to an email or a role", function(done){
    rolodex.org.invite(org.id, "not an email", "member", function(errors){
      errors.details.should.have.property("email")
      rolodex.org.invite(org.id, "x@invites.test", "owner", function(errors){
        errors.details.should.have.property("role")
        done()
      })
    })
  })

  it("stops an org's codes when it is deleted", function(done){
    rolodex.org.create({ slug: "invites-gone", name: "Gone", admin: admin.id }, function(errors, gone){
      rolodex.org.invite(gone.id, "someone@invites.test", "member", function(errors, invite){
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

  it("forgets where a removed member's invite went", function(done){
    rolodex.org.removeMember(org.id, sallyWork.id, function(errors){
      should.not.exist(errors)
      rolodex.org.invited(org.id, function(errors, invited){
        invited.should.not.have.property(sallyWork.id)
        done()
      })
    })
  })

  after(function(){
    client.flushall()
  })

})
