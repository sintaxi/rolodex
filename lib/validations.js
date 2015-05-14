var validator = require("validator")
var hash      = require("./hash")

exports.existOnCreate = function(field, obj, errors, next){
  if(obj.hasOwnProperty("created_at")){
    next(obj)
  }else{
    if(obj.hasOwnProperty(field)){
      next()
    }else{
      errors.push("must exist")
      next()
    }
  }
}

exports.present = function(field, obj, errors, next){
  if(obj[field] && obj[field].length > 0){
    next()
  }else{
    errors.push("must be present")
    next()
  }
}


exports.presentPassword = function(field, obj, errors, next){
  // we aleady have a password in the system
  if(obj.hasOwnProperty("hash"))
    return next()

  // account already has a verified email
  if(obj.hasOwnProperty("email_verified_at") && obj["email_verified_at"] != null){
    return next()
  }

  // account is being created with verified email
  if(obj.hasOwnProperty("email_verified") && obj["email_verified"] === true){
    next()
  }else{
    if(obj.hasOwnProperty("password") && obj["password"].length > 0){
      next()
    }else{
      errors.push("must be present")
      next()
    }
  }
}

exports.confirmation = function(field, obj, errors, next){
  if(obj.hasOwnProperty(field)){
    if(obj.hasOwnProperty(field + "_confirmation")){
      if(obj[field] === obj[field + "_confirmation"]){
        next()
      }else{
        errors.push("confirmation must match")
        next()
      }
    }else{
      errors.push("confirmation must be present")
      next()
    }
  }else{
    next()
  }
}

exports.presentOnCreate = function(field, obj, errors, next){
  if(!obj.id && (!obj[field] || obj[field].length < 1)){
    errors.push("must be present")
  }
  next()
}

exports.name = function(field, obj, errors, next){
  if(obj.hasOwnProperty(field) && typeof obj[field] !== 'undefined') {
    if(obj[field].length < 1) {
      errors.push("must not be empty")
    }
    if(obj[field].length > 64) {
      errors.push("must be 64 characters or less")
    }
    if(obj[field].replace(/[a-zA-Z\ \.]+/g, '').length > 0) {
      errors.push("must only contain alpha, space and/or period characters")
    }
  }
  next()
}

exports.email = function(field, obj, errors, next) {
  try {
    validator.check(obj[field]).isEmail()
  } catch (e) {
    errors.push("must be valid")
  }
  next()
}

exports.verifiedEmail = function(field, obj, errors, next){
  var msg = "must be verified"

  // aleady verified
  if(obj.hasOwnProperty("email_verified_at")) next()

  // password provided so we dont care about this
  if(obj.hasOwnProperty("password")) next()

  // ok, looks like we cant let them off the hook
  if(obj.hasOwnProperty("email_verified")){
    next()
    // if(obj["email_verified"] === true){
    //   next()
    // }else{
    //   errors.push(msg)
    // }
  }else{
    errors.push(msg)
  }

  next()
}

exports.unique = function(field, obj, errors, next){
  var namespace = this.locals.namespace
  var client    = this.locals.client

  var key = namespace + ":" + field + ":" + obj[field];
  client.get(key, function(err, id){
    // if id is returned then this value is in use
    if(id){
      // if id matches obj.id then this is an
      // update and should be accepted.
      if(id != obj.id){
        errors.push("already in use")
      }
    }
    next()
  })
}
