var validator = require("validator")

exports.present = function(field, obj, errors, next){
  if(obj[field] && obj[field].length > 0){
    next()
  }else{
    errors.push("must be present")
    next()
  }
}

exports.presentOnCreate = function(field, obj, errors, next){
  if(!obj.id && (!obj[field] || obj[field].length < 1)){
    errors.push("must be present")
  }
  next()
}

exports.email = function(field, obj, errors, next){
  try {
    validator.check(obj[field]).isEmail()
  } catch (e) {
    errors.push("must be valid")
  }
  next()
}

exports.unique = function(field, obj, errors, next){
  var key = scope + ":" + field + ":" + obj[field];
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
