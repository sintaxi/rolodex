// This is not a Model in the traditional sense
// this provides functions to control an account
// object. The Account object has state but this
// is only to describe rolodex what kind of behavior
// it should apply to the object that is passed in.
//
// var account = new Model({
//   scope: "account",
//   locals: {},
//   filters: {
//     in     : [],
//     before : [],
//     after  : [],
//     out    : []
//   },
//   validations: {
//     "username": [],
//     "password": []
//   }
// })
//
// account.validate(obj, function(errors, obj){
//   ...
// })
//
// account.validate(id, obj, function(errors, obj){
//   ...
// })
//
// account.create(obj, function(errors, obj){
//   ...
// })
// 
// account.update(id, obj, function(errors, obj){
//   ...
// })
// 
// account.get(id, function(obj){
//   ...
// })
//
// account.get(field, value, function(obj){
//   ...
// })
//
// account.destroy(id, function(errors, obj){
//   ...
// })
//


var flow = require("./flow")

module.exports = function(config){
  
  // make locals available  
  for(var local in config.locals)(function(local){
    this[local] = config.locals[local]
  })(local)
  
  var validations = config.validations
  var filters     = config.filters

  var Int = function(){}
  
  Int.prototype._valid = function(obj, cb){
    var errors = {
      messages: [],
      fields: {}
    }
    var count = 0
    var total = Object.keys(validations).length

    // we need to filter first
    flow.filter(obj, filters.before, function(filtered_object){
      // validate!
      for(var field in validations)(function(field){  
        flow.validate(field, filtered_object, validations[field], function(field_errors){
          count ++
          
          if(field_errors && field_errors.length > 0){
            errors.messages.push(field + " " + field_errors[0])
            errors.fields[field] = field_errors[0]
          }

          // validations are done
          if(total == count){
            cb(errors.messages.length > 0 ? errors : null, filtered_object) 
          }
          
        })
      })(field)    
    })
    
  }
  
  Int.prototype.valid = function(id, obj, cb){
    if(!cb){
      cb  = obj
      obj = id
      id  = null
    }
    var that = this;
    if(id){
      client.hgetall("account:" + id, function(err, record){
        for(var prop in obj)(function(prop){
          record[prop] = obj[prop]  
        })(prop)
        record.id = id
        that._valid(record, cb)    
      })
    }else{
      that._valid(obj, cb)
    }
  }
  
  Int.prototype.save = function(id, obj, cb){
    if(!cb){
      cb  = obj
      obj = id
      id  = null
    }
    delete obj.id    
    delete obj.uuid
    delete obj.created_at
    delete obj.updated_at
    delete obj.hash
    var that = this;
    that.valid(id, obj, function(errors, record){
      if(errors){
        cb(errors, null)        
      }else{
        if(that.write){
          that.write(record, cb)  
        }else{
          console.log("must create a write() method.")
          process.exit()
        }
        
      }      
    })
  }
  
  Int.prototype.get = function(id, cb){
    this.read(id, cb)
  }
  
  Int.prototype.create = function(obj, cb){
    this.save(null, obj, cb)
  }
  
  Int.prototype.update = function(id, obj, cb){
    this.save(id, obj, cb)
  }
  
  return new Int()
}

