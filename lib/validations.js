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

exports.unique = function(client){
  var client = client;
  
  return function(field, obj, errors, next){
    var key = field + ":" + obj[field];
    client.get(key, function(err, id){
      if(id){
        // make sure record doesnt belong to this user
        if(id != obj.id){
          errors.push("already in use")    
        }
      }
      next()
    })
  }
  
}
