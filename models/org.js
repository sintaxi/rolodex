var filters = require("../lib/filters")

/**
 * org
 *
 * Who belongs together (slushi plans/b2b.md, "Orgs"). An org is a
 * container of accounts with roles; domains, money and tokens live
 * elsewhere and refer to an org by its id, which never changes.
 *
 *   org:<id>              hash    id, slug, name, created_at, updated_at,
 *                                 created_by, deleted_at (a tombstone)
 *   org:slug:<slug>       string  -> id: the org's live slug, or an old one
 *                                 that still resolves to it (a soft alias)
 *   org:slug-hold:<slug>  string  -> id, expires after 30 days: the old slug
 *                                 a rename protects. One per org: renaming
 *                                 again turns the previous one into a soft
 *                                 alias, so renames can't stockpile names
 *   org:<id>:slugs        set     the slugs that resolve to the org
 *
 * An org holds one live slug. A soft alias resolves to its org until
 * another org claims it; that's safe, since using an org's slug needs
 * membership of that org. Deleting an org releases its slugs at once.
 *   org:<id>:members      hash    account id -> "admin" | "member"
 *   account:<id>:orgs     set     the account's org ids
 *
 * Every write is one lua script, so its rules and its keys move together:
 * slugs are unique, an org always has an admin, caps are checked in the
 * same write. Caps are passed in (whether an org is free is the caller's
 * question). Policy beyond integrity, like who may create an org, is the
 * caller's too. Master only: slave mode has no org methods.
 */

var ROLES = ["admin", "member"]

// how long a rename protects the slug it leaves
var HOLD = 60 * 60 * 24 * 30

// names nobody's org gets: protocol words (read as a forced protocol in
// the domain-or-path slot), surge's own, the ones that would let an org
// pass as part of the platform, and the verbs that share the org's slot
// in the cli (`surge orgs list` beside `surge orgs <org>`). Disputes over
// anything else are handled by hand
var RESERVED = [
  "http", "https", "www", "api", "admin", "administrator", "root",
  "support", "help", "docs", "status", "mail", "email", "smtp", "dns",
  "ns", "cdn", "static", "billing", "security", "abuse", "legal",
  "terms", "privacy", "pricing", "login", "signup", "account", "accounts",
  "org", "orgs", "team", "teams", "settings", "dashboard", "app", "blog",
  "about", "staff", "official", "system", "list"
]

// [a-z0-9-], 3-63 characters, no dash at either end
var validSlug = function(slug){
  return typeof slug === "string"
    && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)
}

// a reserved name, or anything that reads as surge itself (surge, surge-*)
var reservedSlug = function(slug){
  return RESERVED.indexOf(slug) !== -1 || /^surge(-|$)/.test(slug)
}

var validName = function(name){
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= 64
}

var CODES = {
  SLUG_TAKEN: ["slug", "already in use"],
  ID_TAKEN:   ["org", "id collision, try again"],
  NO_ORG:     ["org", "does not exist"],
  NO_ACCOUNT: ["account", "does not exist"],
  ADMIN_CAP:  ["org", "admin has reached the limit of orgs"],
  CAP:        ["members", "org has reached its member limit"],
  LAST_ADMIN: ["role", "org needs at least one admin"],
  NOT_MEMBER: ["account", "is not a member"],
  SOLE_ADMIN: ["account", "is the only admin of an org"]
}

var fail = function(field, msg){
  var details = {}
  details[field] = msg
  return { messages: [field + " " + msg], details: details }
}

// a script's redis.error_reply("CODE") arrives as "ERR CODE"
var fromRedis = function(err){
  var code = String((err && err.message) || err).replace(/^ERR\s+/, "").trim()
  var known = CODES[code]
  return known ? fail(known[0], known[1]) : fail("org", "write failed: " + code)
}

var LIVE = "local function live(key) return redis.call('EXISTS', key) == 1 and redis.call('HEXISTS', key, 'deleted_at') == 0 end\n"

// may org `id` take `slug`? Not while another org's hold protects it;
// yes if it resolves to nothing, to this org, to a deleted org, or to
// another org that has moved on from it (a soft alias). claim takes it,
// pulling it from the org it was an alias of
var SLUGS = [
  "local function claimable(slug, id)",
  "  local hold = redis.call('GET', 'org:slug-hold:' .. slug)",
  "  if hold and hold ~= id then return false end",
  "  local holder = redis.call('GET', 'org:slug:' .. slug)",
  "  if not holder or holder == id then return true end",
  "  if redis.call('HEXISTS', 'org:' .. holder, 'deleted_at') == 1 then return true end",
  "  return redis.call('HGET', 'org:' .. holder, 'slug') ~= slug",
  "end",
  "local function claim(slug, id)",
  "  local holder = redis.call('GET', 'org:slug:' .. slug)",
  "  if holder and holder ~= id then redis.call('SREM', 'org:' .. holder .. ':slugs', slug) end",
  "  redis.call('SET', 'org:slug:' .. slug, id)",
  "  redis.call('SADD', 'org:' .. id .. ':slugs', slug)",
  "end"
].join("\n") + "\n"
var ADMINS = "local function admins(key) local n = 0 for _, r in ipairs(redis.call('HVALS', key)) do if r == 'admin' then n = n + 1 end end return n end\n"

// KEYS org, slug, members, slugs | ARGV id, slug, name, now, creator, adminCap, n, (aid, role)*n
var CREATE = SLUGS + [
  "if redis.call('EXISTS', KEYS[1]) == 1 then return redis.error_reply('ID_TAKEN') end",
  "if not claimable(ARGV[2], ARGV[1]) then return redis.error_reply('SLUG_TAKEN') end",
  "local id, creator, cap, n = ARGV[1], ARGV[5], tonumber(ARGV[6]), tonumber(ARGV[7])",
  "for i = 0, n - 1 do",
  "  if redis.call('EXISTS', 'account:' .. ARGV[8 + i * 2]) == 0 then return redis.error_reply('NO_ACCOUNT') end",
  "end",
  "if cap > 0 then",
  "  local held = 0",
  "  for _, oid in ipairs(redis.call('SMEMBERS', 'account:' .. creator .. ':orgs')) do",
  "    if redis.call('HGET', 'org:' .. oid .. ':members', creator) == 'admin' then held = held + 1 end",
  "  end",
  "  if held >= cap then return redis.error_reply('ADMIN_CAP') end",
  "end",
  "redis.call('HSET', KEYS[1], 'id', id, 'slug', ARGV[2], 'name', ARGV[3], 'created_at', ARGV[4], 'updated_at', ARGV[4], 'created_by', creator)",
  "claim(ARGV[2], id)",
  "for i = 0, n - 1 do",
  "  local aid, role = ARGV[8 + i * 2], ARGV[9 + i * 2]",
  "  redis.call('HSET', KEYS[3], aid, role)",
  "  redis.call('SADD', 'account:' .. aid .. ':orgs', id)",
  "end",
  "return 'OK'"
].join("\n")

// KEYS org | ARGV id, slug or "", name or "", now, hold seconds.
// The slug left behind is protected for the hold; the one protected
// before it (if any) drops to a soft alias, or becomes live again
var RENAME = LIVE + SLUGS + [
  "if not live(KEYS[1]) then return redis.error_reply('NO_ORG') end",
  "local id, new = ARGV[1], ARGV[2]",
  "local old = redis.call('HGET', KEYS[1], 'slug')",
  "if new ~= '' and new ~= old then",
  "  if not claimable(new, id) then return redis.error_reply('SLUG_TAKEN') end",
  "  claim(new, id)",
  "  local prev = redis.call('HGET', KEYS[1], 'held')",
  "  if prev and redis.call('GET', 'org:slug-hold:' .. prev) == id then redis.call('DEL', 'org:slug-hold:' .. prev) end",
  "  redis.call('SET', 'org:slug-hold:' .. old, id, 'EX', tonumber(ARGV[5]))",
  "  redis.call('HSET', KEYS[1], 'held', old, 'slug', new)",
  "end",
  "if ARGV[3] ~= '' then redis.call('HSET', KEYS[1], 'name', ARGV[3]) end",
  "redis.call('HSET', KEYS[1], 'updated_at', ARGV[4])",
  "return 'OK'"
].join("\n")

// KEYS org, members, account orgs | ARGV id, aid, role, cap
var SET_MEMBER = LIVE + ADMINS + [
  "if not live(KEYS[1]) then return redis.error_reply('NO_ORG') end",
  "if redis.call('EXISTS', 'account:' .. ARGV[2]) == 0 then return redis.error_reply('NO_ACCOUNT') end",
  "local current = redis.call('HGET', KEYS[2], ARGV[2])",
  "local cap = tonumber(ARGV[4])",
  "if not current and cap > 0 and redis.call('HLEN', KEYS[2]) >= cap then return redis.error_reply('CAP') end",
  "if current == 'admin' and ARGV[3] ~= 'admin' and admins(KEYS[2]) <= 1 then return redis.error_reply('LAST_ADMIN') end",
  "redis.call('HSET', KEYS[2], ARGV[2], ARGV[3])",
  "redis.call('SADD', KEYS[3], ARGV[1])",
  "return 'OK'"
].join("\n")

// KEYS org, members, account orgs | ARGV id, aid
var REMOVE_MEMBER = LIVE + ADMINS + [
  "if not live(KEYS[1]) then return redis.error_reply('NO_ORG') end",
  "local current = redis.call('HGET', KEYS[2], ARGV[2])",
  "if not current then return redis.error_reply('NOT_MEMBER') end",
  "if current == 'admin' and admins(KEYS[2]) <= 1 then return redis.error_reply('LAST_ADMIN') end",
  "redis.call('HDEL', KEYS[2], ARGV[2])",
  "redis.call('SREM', KEYS[3], ARGV[1])",
  "return 'OK'"
].join("\n")

// KEYS org, members, slugs | ARGV id, now. Leaves a tombstone: the record
// keeps its id with deleted_at. Its slugs and hold are released at once,
// so creating and deleting orgs reserves nothing
var DELETE = [
  "if redis.call('EXISTS', KEYS[1]) == 0 then return redis.error_reply('NO_ORG') end",
  "if redis.call('HEXISTS', KEYS[1], 'deleted_at') == 1 then return 'OK' end",
  "for _, slug in ipairs(redis.call('SMEMBERS', KEYS[3])) do",
  "  if redis.call('GET', 'org:slug:' .. slug) == ARGV[1] then redis.call('DEL', 'org:slug:' .. slug) end",
  "  if redis.call('GET', 'org:slug-hold:' .. slug) == ARGV[1] then redis.call('DEL', 'org:slug-hold:' .. slug) end",
  "end",
  "redis.call('DEL', KEYS[3])",
  "for _, aid in ipairs(redis.call('HKEYS', KEYS[2])) do",
  "  redis.call('SREM', 'account:' .. aid .. ':orgs', ARGV[1])",
  "end",
  "redis.call('DEL', KEYS[2])",
  "redis.call('HSET', KEYS[1], 'deleted_at', ARGV[2])",
  "return 'OK'"
].join("\n")

// KEYS account orgs | ARGV aid. Refuses while the account is the only
// admin of any org; otherwise takes it out of every org
var LEAVE_ALL = ADMINS + [
  "local orgs = redis.call('SMEMBERS', KEYS[1])",
  "for _, oid in ipairs(orgs) do",
  "  local members = 'org:' .. oid .. ':members'",
  "  if redis.call('HGET', members, ARGV[1]) == 'admin' and admins(members) <= 1 then return redis.error_reply('SOLE_ADMIN') end",
  "end",
  "for _, oid in ipairs(orgs) do redis.call('HDEL', 'org:' .. oid .. ':members', ARGV[1]) end",
  "redis.call('DEL', KEYS[1])",
  "return 'OK'"
].join("\n")

module.exports = function(config){
  var client = config.client
  var hold   = config.slugHold || HOLD
  var now = function(){ return (new Date()).toJSON() }

  var newId = function(){
    var id
    filters.id({}, function(obj){ id = obj.id })
    return id
  }

  var orgKey     = function(id){ return "org:" + id }
  var membersKey = function(id){ return "org:" + id + ":members" }
  var accountKey = function(aid){ return "account:" + aid + ":orgs" }

  var shape = function(raw){
    if (!raw || raw.deleted_at) return null
    return {
      id: raw.id, slug: raw.slug, name: raw.name,
      created_at: raw.created_at, updated_at: raw.updated_at, created_by: raw.created_by
    }
  }

  var org = {}

  // by id, by its live slug, or by an old slug that still resolves to it
  org.get = function(q, callback){
    if (!q) return callback(null)
    client.hgetall(orgKey(q), function(err, raw){
      if (raw) return callback(shape(raw))
      client.get("org:slug:" + q, function(err, id){
        if (!id) return callback(null)
        client.hgetall(orgKey(id), function(err, raw){ callback(shape(raw)) })
      })
    })
  }

  // props: { slug, name, admin: account id, members: { aid: role }, adminCap }
  // the admin is the first admin; members may add others (e.g. a bot)
  org.create = function(props, callback){
    props = props || {}
    if (!validSlug(props.slug)) return callback(fail("slug", "must be 3-63 lowercase letters, digits or dashes"))
    if (reservedSlug(props.slug)) return callback(fail("slug", "is reserved"))
    if (!validName(props.name)) return callback(fail("name", "must be 1-64 characters"))
    if (!props.admin) return callback(fail("admin", "must be present"))
    var members = {}
    Object.keys(props.members || {}).forEach(function(aid){ members[aid] = props.members[aid] })
    members[props.admin] = "admin"
    for (var aid in members){
      if (ROLES.indexOf(members[aid]) === -1) return callback(fail("role", "must be admin or member"))
    }
    var id = newId(), t = now(), pairs = []
    Object.keys(members).forEach(function(aid){ pairs.push(aid, members[aid]) })
    client.eval(CREATE,
      [orgKey(id), "org:slug:" + props.slug, membersKey(id), orgKey(id) + ":slugs"],
      [id, props.slug, props.name.trim(), t, props.admin, props.adminCap || 0, pairs.length / 2].concat(pairs),
      function(err){
        if (err) return callback(fromRedis(err))
        org.get(id, function(record){ callback(null, record) })
      })
  }

  // changes: { slug, name }. The id never changes. The slug left behind is
  // protected for 30 days, then resolves as a soft alias until claimed
  org.rename = function(id, changes, callback){
    changes = changes || {}
    if (changes.slug == null && changes.name == null) return callback(fail("org", "nothing to change"))
    if (changes.slug != null && !validSlug(changes.slug)) return callback(fail("slug", "must be 3-63 lowercase letters, digits or dashes"))
    if (changes.slug != null && reservedSlug(changes.slug)) return callback(fail("slug", "is reserved"))
    if (changes.name != null && !validName(changes.name)) return callback(fail("name", "must be 1-64 characters"))
    client.eval(RENAME,
      [orgKey(id)],
      [id, changes.slug || "", changes.name != null ? changes.name.trim() : "", now(), hold],
      function(err){
        if (err) return callback(fromRedis(err))
        org.get(id, function(record){ callback(null, record) })
      })
  }

  org.members = function(id, callback){
    client.hgetall(orgKey(id), function(err, raw){
      if (!shape(raw)) return callback(fail("org", "does not exist"))
      client.hgetall(membersKey(id), function(err, members){ callback(null, members || {}) })
    })
  }

  // add an account, or change its role. opts: { cap } members per org
  org.setMember = function(id, aid, role, opts, callback){
    if (!callback){ callback = opts; opts = {} }
    if (ROLES.indexOf(role) === -1) return callback(fail("role", "must be admin or member"))
    client.eval(SET_MEMBER, [orgKey(id), membersKey(id), accountKey(aid)], [id, aid, role, (opts && opts.cap) || 0], function(err){
      if (err) return callback(fromRedis(err))
      org.members(id, callback)
    })
  }

  org.removeMember = function(id, aid, callback){
    client.eval(REMOVE_MEMBER, [orgKey(id), membersKey(id), accountKey(aid)], [id, aid], function(err){
      if (err) return callback(fromRedis(err))
      org.members(id, callback)
    })
  }

  // a tombstone: the org stops resolving and its members are released.
  // Whether it may be deleted (does it own domains?) is the caller's check
  org.del = function(id, callback){
    client.eval(DELETE, [orgKey(id), membersKey(id), orgKey(id) + ":slugs"], [id, now()], function(err){
      callback(err ? fromRedis(err) : null)
    })
  }

  // the account's orgs, each with the account's role in it
  org.ofAccount = function(aid, callback){
    client.smembers(accountKey(aid), function(err, ids){
      ids = ids || []
      var out = [], left = ids.length
      if (!left) return callback(null, out)
      ids.forEach(function(id){
        org.get(id, function(record){
          client.hget(membersKey(id), aid, function(err, role){
            if (record && role) out.push(Object.assign(record, { role: role }))
            if (--left === 0){
              out.sort(function(a, b){ return a.name.localeCompare(b.name) })
              callback(null, out)
            }
          })
        })
      })
    })
  }

  // for account deletion: refuses while the account is an org's only admin
  org.leaveAll = function(aid, callback){
    client.eval(LEAVE_ALL, [accountKey(aid)], [aid], function(err){
      callback(err ? fromRedis(err) : null)
    })
  }

  return org
}
