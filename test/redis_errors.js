var fs     = require("fs")
var should = require("should")
var client = require("../lib/client")()

var config = JSON.parse(fs.readFileSync(__dirname + "/config/master.json"))

// a redis error still calls back - with errors, or an empty answer - so a
// request never waits on a reply that isn't coming

// the real client, with transactions refused
var failingWrites = function(){
  var c = Object.create(client)
  c.multi = function(){
    var chain = {}
    ;["set", "del", "expire", "hset", "hmset", "zadd", "zrem", "hgetall"].forEach(function(cmd){
      chain[cmd] = function(){ return chain }
    })
    chain.exec = function(cb){ setImmediate(function(){ cb(new Error("refused")) }) }
    return chain
  }
  return c
}

// the real client, with reads refused
var failingReads = function(){
  var c = Object.create(client)
  ;["get", "hgetall", "zrevrange", "zrevrangebyscore"].forEach(function(cmd){
    c[cmd] = function(){
      var cb = arguments[arguments.length - 1]
      setImmediate(function(){ cb(new Error("refused")) })
    }
  })
  return c
}

describe("redis errors", function(){
  var rolodex = require("../")(config, client)
  var writes  = require("../")(config, failingWrites())
  var reads   = require("../")(config, failingReads())
  var account

  before(function(done){
    rolodex.account.set({ "email": "errors@sintaxi.com", "email_verified": true }, function(errors, record){
      account = record
      done()
    })
  })

  it("reports a refused write on set", function(done){
    writes.account.set({ "email": "refused@sintaxi.com", "email_verified": true }, function(errors, record){
      should.exist(errors)
      errors.details.should.have.property("account", "could not be saved")
      should.not.exist(record)
      done()
    })
  })

  it("reports a refused write on an update", function(done){
    writes.account.set(account.id, { "first_name": "Refused" }, function(errors, record){
      should.exist(errors)
      should.not.exist(record)
      done()
    })
  })

  it("reports a refused read on an update", function(done){
    reads.account.set(account.id, { "first_name": "Refused" }, function(errors, record){
      should.exist(errors)
      should.not.exist(record)
      done()
    })
  })

  it("reports a refused write on del", function(done){
    writes.account.del(account.id, function(errors){
      should.exist(errors)
      errors.details.should.have.property("account", "could not be removed")
      rolodex.account.get(account.id, function(record){
        should.exist(record)
        done()
      })
    })
  })

  it("never hands out a token that wasn't stored", function(done){
    writes.account.token(account.id, function(errors, token){
      should.exist(errors)
      errors.details.should.have.property("token", "could not be saved")
      should.not.exist(token)
      done()
    })
  })

  it("refuses a token it couldn't look up", function(done){
    rolodex.account.token(account.id, function(errors, token){
      reads.account.authenticate(token, function(errors, record){
        should.exist(errors)
        should.not.exist(record)
        done()
      })
    })
  })

  it("answers all and group with nothing when redis refuses", function(done){
    writes.account.all(function(accounts){
      accounts.should.eql([])
      reads.account.all(function(accounts){
        accounts.should.eql([])
        writes.account.group(5, function(accounts){
          accounts.should.eql([])
          done()
        })
      })
    })
  })

  after(function(){
    client.flushall()
  })

})
