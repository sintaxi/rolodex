var uuid = require("node-uuid")
var hash = require("./hash")


exports.log = function(obj, next){
  console.log(obj)
  next()
}
// in filters
exports.blacklist = function(obj, next){
  delete obj.uuid
  delete obj.created_at
  delete obj.updated_at
  delete obj.hash
  next()
}

// out filters
exports.clean = function(obj, next){
  //if(obj.id) obj.id = parseInt(obj.id)
  if(obj.login_count) obj.login_count = parseInt(obj.login_count)
  delete obj.hash
  next()
}

// after filters
exports.password = function(obj, next){
  delete obj.password
  delete obj.password_confirmation
  next()
}

// before filters
exports.uuid = function(obj, next){
  if(!obj.id){
    obj.uuid = uuid.v4()
  }
  next()
}

exports.created_at = function(obj, next){
  if(!obj.id){
    obj.created_at = (new Date()).toJSON()
  }
  next()
}

exports.updated_at = function(obj, next){
  if(obj.id){
    obj.updated_at = (new Date()).toJSON()
  }else{
    obj.updated_at = null
  }
  next()
}

exports.hash = function(obj, next){
  if(obj.password && obj.password.length > 0){
    obj.hash = hash.create(obj.password)
  }
  next()
}

exports.login_at = function(obj, next){
  if(!obj.id){
    obj.login_at = null
  }
  next()
}

exports.login_count = function(obj, next){
  if(!obj.id){
    obj.login_count = 0
  }
  next()
}
