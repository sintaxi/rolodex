var uuid = require("node-uuid")
var auth = require("./password")

exports.blacklist = function(obj, next){
  delete obj.uuid
  delete obj.created_at
  delete obj.updated_at
  delete obj.hash
  next()
}

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

exports.password = function(obj, next){
  if(obj.password && obj.password.length > 0){
    obj.hash = auth.hash(obj.password)
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
