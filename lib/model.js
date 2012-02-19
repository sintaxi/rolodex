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
      that.read(id, function(record){
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
    var that = this;
    
    flow.filter(obj, filters.in, function(filtered_object){
      that.valid(id, filtered_object, function(errors, record){
        if(errors){
          cb(errors, null)        
        }else{
          if(that.write){
            that.write(record, function(err, obj){
              if(!err){
                that.out(obj, function(record){
                  cb(null, record)
                })
              }
            })  
          }else{
            console.log("must create a write() method.")
            process.exit()
          }

        }      
      })  
    })
    
  }
  
  Int.prototype.out = function(record, cb){
    if(record){
      flow.filter(record, filters.out, function(filtered_record){
        cb(filtered_record)
      })
    }else{
      cb(null)
    }
  }
  
  Int.prototype.get = function(id, cb){
    var that = this
    that.read(id, function(record){
      that.out(record, function(record){
        cb(record)
      })
    })
  }
  
  Int.prototype.create = function(obj, cb){
    this.save(null, obj, cb)
  }
  
  Int.prototype.update = function(id, obj, cb){
    this.save(id, obj, cb)
  }
  
  return new Int()
}

