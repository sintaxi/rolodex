var crypto  = require("crypto")
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
 * An invite is an anonymous code, joined by whichever signed-in account
 * holds it (slushi plans/b2b.md, decided 2026-10-28: Surge never emails a
 * code, whoever invites delivers it). Codes are single-use and expire;
 * only their hash is stored, so an invite is listed by a hint instead.
 *   org:<id>:invites      hash    key -> json { key, role, by, hint,
 *                                 created_at, expires_at }: several live at
 *                                 once, up to the caller's limit. Invites
 *                                 don't count against the member cap;
 *                                 joining does, so a full org refuses the
 *                                 join and leaves the code good. (Invites
 *                                 from before 2026-10-28 are keyed by the
 *                                 email they went to; they join, list and
 *                                 scrap the same way until they expire)
 *   org:invite:<key>      string  -> org id, expires with the invite. key is
 *                                 the sha256 of the code
 *   org:<id>:invited      hash    account id -> the email its invite went to
 *                                 (email invites only)
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

// how long an invite's code can be used
var INVITE_TTL = 60 * 60 * 24 * 7

// a code is 16 letters and digits, read in groups of four. Case and dashes
// don't matter, and only its sha256 is stored
var ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
var newCode = function(){
  var bytes = crypto.randomBytes(16), out = ""
  for (var i = 0; i < 16; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out.match(/.{4}/g).join("-")
}
var codeKey = function(code){
  var plain = String(code || "").toLowerCase().replace(/[^a-z0-9]/g, "")
  return crypto.createHash("sha256").update(plain).digest("hex")
}

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
  MEMBER:     ["email", "is already a member"],
  NO_INVITE:  ["invite", "is not valid"],
  CODE_TAKEN: ["code", "is taken, try another"],
  INVITES:    ["invites", "org has reached its limit of pending invites"],
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
// drops the expired invites from an org's invites hash
var PRUNE = [
  "local function prune(key, now)",
  "  local all = redis.call('HGETALL', key)",
  "  for i = 1, #all, 2 do",
  "    if tonumber(cjson.decode(all[i + 1]).expires_at) <= now then redis.call('HDEL', key, all[i]) end",
  "  end",
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

// KEYS org, members, account orgs, invites | ARGV id, aid, role, cap, now
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
  "redis.call('HDEL', 'org:' .. ARGV[1] .. ':invited', ARGV[2])",
  "redis.call('SREM', KEYS[3], ARGV[1])",
  "return 'OK'"
].join("\n")

// KEYS org, members, invites | ARGV id, role, by, now ms, now iso, ttl
// seconds, key, hint, cap, most live invites (0: no limit). A full org
// takes no invites: nobody could join from them. A code already in use
// anywhere is refused, so the caller draws another
var INVITE = LIVE + PRUNE + [
  "if not live(KEYS[1]) then return redis.error_reply('NO_ORG') end",
  "local id, now, ttl, cap, most = ARGV[1], tonumber(ARGV[4]), tonumber(ARGV[6]), tonumber(ARGV[9]), tonumber(ARGV[10])",
  "if cap > 0 and redis.call('HLEN', KEYS[2]) >= cap then return redis.error_reply('CAP') end",
  "prune(KEYS[3], now)",
  "if most > 0 and redis.call('HLEN', KEYS[3]) >= most then return redis.error_reply('INVITES') end",
  "if redis.call('EXISTS', 'org:invite:' .. ARGV[7]) == 1 then return redis.error_reply('CODE_TAKEN') end",
  "redis.call('HSET', KEYS[3], ARGV[7], cjson.encode({ key = ARGV[7], role = ARGV[2], by = ARGV[3], hint = ARGV[8], created_at = ARGV[5], expires_at = now + ttl * 1000 }))",
  "redis.call('SET', 'org:invite:' .. ARGV[7], id, 'EX', ttl)",
  "return 'OK'"
].join("\n")

// KEYS invites | ARGV email, role or "" (to withdraw the invite)
var SET_INVITE = [
  "local raw = redis.call('HGET', KEYS[1], ARGV[1])",
  "if not raw then return redis.error_reply('NO_INVITE') end",
  "local invite = cjson.decode(raw)",
  "if ARGV[2] == '' then",
  "  redis.call('HDEL', KEYS[1], ARGV[1])",
  "  redis.call('DEL', 'org:invite:' .. invite.key)",
  "else",
  "  invite.role = ARGV[2]",
  "  redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(invite))",
  "end",
  "return 'OK'"
].join("\n")

// KEYS org:invite:<key> | ARGV key, aid, now ms, org id or "", cap. The
// code is spent whether or not the account was already a member, but not
// when it belongs to another org than the one named, or when the org is
// full (it works again once a seat frees up). Returns { org id, role, "1"
// if the account was already in the org }
var JOIN = LIVE + [
  "local id = redis.call('GET', KEYS[1])",
  "if not id then return redis.error_reply('NO_INVITE') end",
  "if ARGV[4] ~= '' and ARGV[4] ~= id then return redis.error_reply('NO_INVITE') end",
  "if redis.call('EXISTS', 'account:' .. ARGV[2]) == 0 then return redis.error_reply('NO_ACCOUNT') end",
  "local org, members, list = 'org:' .. id, 'org:' .. id .. ':members', 'org:' .. id .. ':invites'",
  "local cap = tonumber(ARGV[5])",
  "if live(org) and cap > 0 and not redis.call('HGET', members, ARGV[2]) and redis.call('HLEN', members) >= cap then return redis.error_reply('CAP') end",
  "redis.call('DEL', KEYS[1])",
  "if not live(org) then return redis.error_reply('NO_INVITE') end",
  "local email, invite",
  "local all = redis.call('HGETALL', list)",
  "for i = 1, #all, 2 do",
  "  local candidate = cjson.decode(all[i + 1])",
  "  if candidate.key == ARGV[1] then email, invite = all[i], candidate end",
  "end",
  "if not invite then return redis.error_reply('NO_INVITE') end",
  "redis.call('HDEL', list, email)",
  "if tonumber(invite.expires_at) <= tonumber(ARGV[3]) then return redis.error_reply('NO_INVITE') end",
  "local current = redis.call('HGET', members, ARGV[2])",
  "if current then return { id, current, '1' } end",
  "redis.call('HSET', members, ARGV[2], invite.role)",
  "if string.find(email, '@', 1, true) then redis.call('HSET', org .. ':invited', ARGV[2], email) end",
  "redis.call('SADD', 'account:' .. ARGV[2] .. ':orgs', id)",
  "return { id, invite.role, '0' }"
].join("\n")

// KEYS org:invite:<key> | ARGV key, org id or "". Cancels the code: it
// stops resolving and leaves the org's pending list. Refused for a code
// that belongs to another org than the one named. Returns the org id
var SCRAP = [
  "local id = redis.call('GET', KEYS[1])",
  "if not id then return redis.error_reply('NO_INVITE') end",
  "if ARGV[2] ~= '' and ARGV[2] ~= id then return redis.error_reply('NO_INVITE') end",
  "redis.call('DEL', KEYS[1])",
  "local list = 'org:' .. id .. ':invites'",
  "local all = redis.call('HGETALL', list)",
  "for i = 1, #all, 2 do",
  "  if cjson.decode(all[i + 1]).key == ARGV[1] then redis.call('HDEL', list, all[i]) end",
  "end",
  "return id"
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
  "for _, raw in ipairs(redis.call('HVALS', 'org:' .. ARGV[1] .. ':invites')) do",
  "  redis.call('DEL', 'org:invite:' .. cjson.decode(raw).key)",
  "end",
  "redis.call('DEL', 'org:' .. ARGV[1] .. ':invites', 'org:' .. ARGV[1] .. ':invited')",
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
  "for _, oid in ipairs(orgs) do redis.call('HDEL', 'org:' .. oid .. ':members', ARGV[1]); redis.call('HDEL', 'org:' .. oid .. ':invited', ARGV[1]) end",
  "redis.call('DEL', KEYS[1])",
  "return 'OK'"
].join("\n")

module.exports = function(config){
  var client = config.client
  var hold   = config.slugHold || HOLD
  var inviteTtl = config.inviteTtl || INVITE_TTL
  var now = function(){ return (new Date()).toJSON() }

  var newId = function(){
    var id
    filters.id({}, function(obj){ id = obj.id })
    return id
  }

  var orgKey     = function(id){ return "org:" + id }
  var membersKey = function(id){ return "org:" + id + ":members" }
  var invitesKey = function(id){ return "org:" + id + ":invites" }
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
    client.eval(SET_MEMBER, [orgKey(id), membersKey(id), accountKey(aid), invitesKey(id)], [id, aid, role, (opts && opts.cap) || 0, Date.now()], function(err){
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

  // invite an email: the code comes back once and is never stored. opts:
  // { by: inviting account id, cap: members per org }. Inviting the same
  // email again replaces the invite
  // an anonymous invite: whoever holds the code joins. opts: { by: account
  // id, code (the caller's shape; 16 letters and digits otherwise), hint
  // (what the pending list shows instead of the code), cap: members per
  // org, most: live invites per org }. A code that's already taken is
  // refused (code: "is taken, try another"), so the caller draws again
  org.invite = function(id, role, opts, callback){
    if (!callback){ callback = opts; opts = {} }
    opts = opts || {}
    if (ROLES.indexOf(role) === -1) return callback(fail("role", "must be admin or member"))
    var code = opts.code || newCode(), t = Date.now()
    client.eval(INVITE, [orgKey(id), membersKey(id), invitesKey(id)],
      [id, role, opts.by || "", t, (new Date(t)).toJSON(), inviteTtl, codeKey(code), opts.hint || "", opts.cap || 0, opts.most || 0],
      function(err){
        if (err) return callback(fromRedis(err))
        callback(null, { code: code, hint: opts.hint || null, role: role, expires_at: (new Date(t + inviteTtl * 1000)).toJSON() })
      })
  }

  // the org a live code invites to (an id), or null
  org.inviteOrg = function(code, callback){
    client.get("org:invite:" + codeKey(code), function(err, id){ callback(id || null) })
  }

  // cancel a code. opts: { org: id } refuses a code for any other org.
  // Calls back with the org id
  org.scrap = function(code, opts, callback){
    if (!callback){ callback = opts; opts = {} }
    opts = opts || {}
    var key = codeKey(code)
    client.eval(SCRAP, ["org:invite:" + key], [key, opts.org || ""], function(err, id){
      if (err) return callback(fromRedis(err))
      callback(null, id)
    })
  }

  // the org's live invites, oldest first: { hint, role, by, created_at,
  // expires_at }, and email for an invite from before codes went anonymous
  org.invites = function(id, callback){
    client.hgetall(invitesKey(id), function(err, raw){
      if (err) return callback(fail("invites", "could not be read"))
      var t = Date.now(), out = []
      Object.keys(raw || {}).forEach(function(field){
        var invite
        try { invite = JSON.parse(raw[field]) } catch(e){ return }
        if (invite.expires_at <= t) return
        var entry = { hint: invite.hint || null, role: invite.role, by: invite.by || null, created_at: invite.created_at, expires_at: (new Date(invite.expires_at)).toJSON() }
        if (field.indexOf("@") !== -1) entry.email = field
        out.push(entry)
      })
      out.sort(function(a, b){ return a.created_at < b.created_at ? -1 : 1 })
      callback(null, out)
    })
  }

  // change a pending email invite's role (invites from before 2026-10-28)
  org.inviteRole = function(id, email, role, callback){
    if (ROLES.indexOf(role) === -1) return callback(fail("role", "must be admin or member"))
    client.eval(SET_INVITE, [invitesKey(id)], [filters.normal(email), role], function(err){
      callback(err ? fromRedis(err) : null)
    })
  }

  // withdraw a pending email invite: its code stops working at once
  org.uninvite = function(id, email, callback){
    client.eval(SET_INVITE, [invitesKey(id)], [filters.normal(email), ""], function(err){
      callback(err ? fromRedis(err) : null)
    })
  }

  // the account holding the code joins, whatever its email. opts: { org:
  // id, cap: members per org }: a code for any other org, or a full org,
  // is refused without spending it. Calls back with { org, role, already }
  org.join = function(code, aid, opts, callback){
    if (!callback){ callback = opts; opts = {} }
    opts = opts || {}
    var key = codeKey(code)
    client.eval(JOIN, ["org:invite:" + key], [key, aid, Date.now(), opts.org || "", opts.cap || 0], function(err, reply){
      if (err) return callback(fromRedis(err))
      org.get(reply[0], function(record){
        if (!record) return callback(fail("invite", "is not valid"))
        callback(null, { org: record, role: reply[1], already: reply[2] === "1" })
      })
    })
  }

  // account id -> the email its invite was sent to
  org.invited = function(id, callback){
    client.hgetall(orgKey(id) + ":invited", function(err, raw){ callback(null, raw || {}) })
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
