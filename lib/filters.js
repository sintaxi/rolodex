var uuid = require("uuid")
var hash = require("./hash")


exports.log = function(obj, next){
  next(obj)
}

// in filters
exports.whitelist = function(obj, next){
  // we dont want arbitrary attributes added to the system,
  // nor do we want nulls added to the db.
  var fields = [
    "email",
    "email_verified",
    "password",
    "password_confirmation",
    "first_name",
    "last_name",
    "payment_id"
  ]
  for(var prop in obj) {
    if(fields.indexOf(prop) === -1 || obj[prop] === null){
      delete obj[prop]
    }
  }
  next(obj)
}

// out filters
exports.clean = function(obj, next){
  // we dont want to output this. ever!
  delete obj.hash

  // some things are better as integers
  if(obj.role)
    obj.role = parseInt(obj.role)

  // some values are optional or should be
  // present even if not set.
  if(!obj.hasOwnProperty("email_verified_at"))
    obj.email_verified_at = null

  if(!obj.hasOwnProperty("payment_id"))
    obj.payment_id = null

  next(obj)
}

// before filters

exports.id = function(obj, next){
  var chars = "0123456789abcdefghiklmnopqrstuvwxyz".split("")
  var code  = "xxxx".replace(/[x]/g, function(c){
    return chars[Math.floor(Math.random() * chars.length)]
  })
  if(!obj.id){
    var aid = new Date().getTime()
      .toString(36)
      .split("")
      .reverse()
      .join("")
      .match(RegExp('.{1,4}', 'g'))
      .reverse()
    aid.push(code)
    obj.id = aid.join("-")
  }
  next(obj)
}

// after filters
exports.password = function(obj, next){
  delete obj.password
  delete obj.password_confirmation
  next(obj)
}

exports.verified_at = function(obj, next){
  if(obj.email_verified === true)
    obj.email_verified_at = (new Date()).toJSON()

  delete obj.email_verified
  next(obj)
}

exports.uuid = function(obj, next){
  if(!obj.uuid){
    obj.uuid = uuid.v4()
  }
  next(obj)
}

exports.role = function(obj, next){
  if(obj.hasOwnProperty("role")){
    var role = parseInt(obj.role)
    if(role < 0 || role > 5){
      obj.role = 5
    }
  }else{
    obj.role = 5
  }
  next(obj)
}

exports.created_at = function(obj, next){
  if(!obj.created_at){
    obj.created_at = (new Date()).toJSON()
  }
  next(obj)
}

exports.updated_at = function(obj, next){
  obj.updated_at = (new Date()).toJSON()
  next(obj)
}

exports.hash = function(obj, next){
  if(obj.password && obj.password.length > 0){
    hash.create(obj.password, function(err, h){
      obj.hash = h
      next(obj)
    })
  }else{
    next(obj)
  }
}

