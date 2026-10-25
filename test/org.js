var fs     = require("fs")
var should = require("should")
var client = require("../lib/client")()

var role   = process.env.ROLE || "master"
var config = JSON.parse(fs.readFileSync(__dirname + "/config/" + role + ".json"))

// orgs (slushi plans/b2b.md): a container of accounts with roles, an id
// that never changes, slugs that can be renamed without breaking anything

describe("org", function(){
  var rolodex = require("../")(config)
  var person, bot, other, orgId

  var account = function(email, done){
    rolodex.account.set({ email: email, password: "heyo", password_confirmation: "heyo" }, function(errors, a){
      should.not.exist(errors)
      done(a)
    })
  }

  before(function(done){
    account("person@org.test", function(a){
      person = a
      account("bot@mail.grokbot.com", function(b){
        bot = b
        account("other@org.test", function(c){
          other = c
          done()
        })
      })
    })
  })

  describe("create", function(){

    it("makes the creator its admin, with a bot as member", function(done){
      var members = {}
      members[bot.id] = "member"
      rolodex.org.create({ slug: "acme", name: " Acme Inc ", admin: person.id, members: members }, function(errors, org){
        should.not.exist(errors)
        org.should.have.property("slug", "acme")
        org.should.have.property("name", "Acme Inc")
        org.should.have.property("created_by", person.id)
        org.id.should.match(/^[0-9a-z-]+$/)
        orgId = org.id
        rolodex.org.members(org.id, function(errors, m){
          m[person.id].should.equal("admin")
          m[bot.id].should.equal("member")
          done()
        })
      })
    })

    it("refuses a slug in use", function(done){
      rolodex.org.create({ slug: "acme", name: "Other", admin: other.id }, function(errors, org){
        should.exist(errors)
        errors.details.should.have.property("slug", "already in use")
        done()
      })
    })

    it("refuses slugs that break the rules", function(done){
      var bad = ["ab", "Acme", "-acme", "acme-", "http", "https", "ac.me", "a".repeat(64)]
      var left = bad.length
      bad.forEach(function(slug){
        rolodex.org.create({ slug: slug, name: "x", admin: other.id }, function(errors){
          should.exist(errors, slug)
          errors.details.should.have.property("slug")
          if (--left === 0) done()
        })
      })
    })

    it("refuses an empty or long name", function(done){
      rolodex.org.create({ slug: "noname", name: "  ", admin: other.id }, function(errors){
        errors.details.should.have.property("name")
        rolodex.org.create({ slug: "noname", name: "x".repeat(65), admin: other.id }, function(errors){
          errors.details.should.have.property("name")
          done()
        })
      })
    })

    it("refuses a member that doesn't exist", function(done){
      rolodex.org.create({ slug: "ghosts", name: "Ghosts", admin: other.id, members: { "nope-nope-nope": "member" } }, function(errors){
        errors.details.should.have.property("account", "does not exist")
        done()
      })
    })

    it("enforces the cap on orgs an account administers", function(done){
      rolodex.org.create({ slug: "capped-one", name: "One", admin: other.id, adminCap: 1 }, function(errors){
        should.not.exist(errors)
        rolodex.org.create({ slug: "capped-two", name: "Two", admin: other.id, adminCap: 1 }, function(errors){
          errors.details.should.have.property("org", "admin has reached the limit of orgs")
          done()
        })
      })
    })
  })

  describe("get", function(){

    it("finds an org by id or slug", function(done){
      rolodex.org.get(orgId, function(byId){
        byId.should.have.property("slug", "acme")
        rolodex.org.get("acme", function(bySlug){
          bySlug.should.have.property("id", orgId)
          done()
        })
      })
    })

    it("finds nothing for an unknown org", function(done){
      rolodex.org.get("no-such-org", function(org){
        should.not.exist(org)
        done()
      })
    })
  })

  describe("rename", function(){

    it("changes the name and keeps the id", function(done){
      rolodex.org.rename(orgId, { name: "Acme Corporation" }, function(errors, org){
        should.not.exist(errors)
        org.should.have.property("name", "Acme Corporation")
        org.should.have.property("id", orgId)
        org.should.have.property("slug", "acme")
        done()
      })
    })

    it("changes the slug, protects the old one for 30 days, and it still resolves", function(done){
      rolodex.org.rename(orgId, { slug: "acme-corp" }, function(errors, org){
        should.not.exist(errors)
        org.should.have.property("slug", "acme-corp")
        rolodex.org.get("acme", function(old){
          old.should.have.property("id", orgId)
          client.eval("return redis.call('TTL', KEYS[1])", ["org:slug-hold:acme"], [], function(err, ttl){
            ttl.should.be.above(60 * 60 * 24 * 29)
            done()
          })
        })
      })
    })

    it("won't hand a protected slug to another org", function(done){
      rolodex.org.create({ slug: "acme", name: "Squatter", admin: other.id }, function(errors){
        errors.details.should.have.property("slug", "already in use")
        done()
      })
    })

    it("protects only one old slug: renaming again frees the first", function(done){
      rolodex.org.rename(orgId, { slug: "acme-inc" }, function(errors, org){
        should.not.exist(errors)
        rolodex.org.get("acme", function(alias){
          alias.should.have.property("id", orgId, "a soft alias still resolves")
          rolodex.org.create({ slug: "acme-corp", name: "Squatter", admin: other.id }, function(errors){
            errors.details.should.have.property("slug", "already in use", "acme-corp is the protected one now")
            done()
          })
        })
      })
    })

    it("lets another org claim a soft alias", function(done){
      rolodex.org.create({ slug: "acme", name: "New Acme", admin: other.id }, function(errors, newAcme){
        should.not.exist(errors)
        rolodex.org.get("acme", function(org){
          org.should.have.property("id", newAcme.id)
          rolodex.org.get(orgId, function(first){
            first.should.have.property("slug", "acme-inc")
            done()
          })
        })
      })
    })

    it("can go back to the slug it protects", function(done){
      rolodex.org.rename(orgId, { slug: "acme-corp" }, function(errors, org){
        should.not.exist(errors)
        org.should.have.property("slug", "acme-corp")
        rolodex.org.create({ slug: "acme-inc", name: "Squatter", admin: other.id }, function(errors){
          errors.details.should.have.property("slug", "already in use", "acme-inc is protected now")
          done()
        })
      })
    })

    it("can claim a slug once its protection lapses", function(done){
      client.del("org:slug-hold:acme-inc", function(){
        rolodex.org.create({ slug: "acme-inc", name: "Late Acme", admin: other.id }, function(errors, org){
          should.not.exist(errors)
          org.should.have.property("slug", "acme-inc")
          done()
        })
      })
    })

    it("can't take another org's live slug", function(done){
      rolodex.org.rename(orgId, { slug: "capped-one" }, function(errors){
        errors.details.should.have.property("slug", "already in use")
        done()
      })
    })

    it("refuses a bad slug or nothing to change", function(done){
      rolodex.org.rename(orgId, { slug: "No" }, function(errors){
        errors.details.should.have.property("slug")
        rolodex.org.rename(orgId, {}, function(errors){
          should.exist(errors)
          done()
        })
      })
    })

    it("keeps reserved names and anything reading as surge", function(done){
      var bad = ["surge", "surge-team", "admin", "support", "www", "api", "list"]
      var left = bad.length
      bad.forEach(function(slug){
        rolodex.org.create({ slug: slug, name: "x", admin: other.id }, function(errors){
          should.exist(errors, slug)
          errors.details.should.have.property("slug", "is reserved")
          if (--left === 0){
            rolodex.org.create({ slug: "surgeon", name: "Surgeon", admin: person.id }, function(errors, org){
              should.not.exist(errors, "surgeon isn't surge")
              done()
            })
          }
        })
      })
    })
  })

  describe("members", function(){

    it("adds a member and changes roles", function(done){
      rolodex.org.setMember(orgId, other.id, "member", function(errors, m){
        should.not.exist(errors)
        m[other.id].should.equal("member")
        rolodex.org.setMember(orgId, other.id, "admin", function(errors, m){
          m[other.id].should.equal("admin")
          done()
        })
      })
    })

    it("enforces a member cap on new members only", function(done){
      rolodex.org.setMember(orgId, other.id, "member", { cap: 3 }, function(errors){
        should.not.exist(errors, "a role change isn't a new member")
        account("fourth@org.test", function(fourth){
          rolodex.org.setMember(orgId, fourth.id, "member", { cap: 3 }, function(errors){
            errors.details.should.have.property("members", "org has reached its member limit")
            done()
          })
        })
      })
    })

    it("keeps at least one admin", function(done){
      rolodex.org.setMember(orgId, person.id, "member", function(errors){
        errors.details.should.have.property("role", "org needs at least one admin")
        rolodex.org.removeMember(orgId, person.id, function(errors){
          errors.details.should.have.property("role", "org needs at least one admin")
          done()
        })
      })
    })

    it("removes a member", function(done){
      rolodex.org.removeMember(orgId, other.id, function(errors, m){
        should.not.exist(errors)
        m.should.not.have.property(other.id)
        rolodex.org.removeMember(orgId, other.id, function(errors){
          errors.details.should.have.property("account", "is not a member")
          done()
        })
      })
    })

    it("lists an account's orgs with its role", function(done){
      rolodex.org.ofAccount(bot.id, function(errors, orgs){
        should.not.exist(errors)
        orgs.length.should.equal(1)
        orgs[0].should.have.property("id", orgId)
        orgs[0].should.have.property("role", "member")
        done()
      })
    })
  })

  describe("account deletion", function(){

    it("refuses while the account is an org's only admin", function(done){
      rolodex.account.del({ email: "person@org.test" }, function(errors){
        should.exist(errors)
        errors.details.should.have.property("account", "is the only admin of an org")
        rolodex.account.get({ email: "person@org.test" }, function(a){
          should.exist(a)
          done()
        })
      })
    })

    it("takes a deleted member out of its orgs", function(done){
      rolodex.account.del({ email: "bot@mail.grokbot.com" }, function(errors){
        should.not.exist(errors)
        rolodex.org.members(orgId, function(errors, m){
          m.should.not.have.property(bot.id)
          done()
        })
      })
    })
  })

  describe("delete", function(){

    it("leaves a tombstone and releases its members", function(done){
      // acme-final goes live and acme-corp is protected when it's deleted
      rolodex.org.rename(orgId, { slug: "acme-final" }, function(errors){
        should.not.exist(errors)
        deleteIt()
      })
      var deleteIt = function(){
      rolodex.org.del(orgId, function(errors){
        should.not.exist(errors)
        rolodex.org.get(orgId, function(org){
          should.not.exist(org)
          rolodex.org.ofAccount(person.id, function(errors, orgs){
            orgs.map(function(o){ return o.id }).should.not.containEql(orgId)
            rolodex.org.del(orgId, function(errors){
              should.not.exist(errors, "deleting twice is harmless")
              done()
            })
          })
        })
      })
      }
    })

    it("releases its slugs at once, the protected one included", function(done){
      rolodex.org.create({ slug: "acme-final", name: "Next Acme", admin: other.id }, function(errors, org){
        should.not.exist(errors, "the live slug is free")
        rolodex.org.create({ slug: "acme-corp", name: "Other Acme", admin: other.id }, function(errors, org2){
          should.not.exist(errors, "the protected slug is free")
          rolodex.org.get("acme-corp", function(found){
            found.should.have.property("id", org2.id)
            done()
          })
        })
      })
    })

    it("lets the former admin go once their orgs are gone", function(done){
      rolodex.org.ofAccount(person.id, function(errors, orgs){
        var left = orgs.length
        var finish = function(){
          rolodex.account.del({ email: "person@org.test" }, function(errors){
            should.not.exist(errors)
            done()
          })
        }
        if (!left) return finish()
        orgs.forEach(function(o){
          rolodex.org.del(o.id, function(){ if (--left === 0) finish() })
        })
      })
    })
  })

  after(function(){
    client.flushall()
    client.quit()
  })

})
