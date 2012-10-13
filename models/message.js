var request     = require("request")
var Thug        = require("thug")
var validations = require("../lib/validations")

var setReplyTo = function(obj, next){
  if(!obj.hasOwnProperty("reply_to")) obj.reply_to = obj.from
  next(obj)
}

module.exports = function(PostmarkCreds) {

  var message = new Thug({
    "locals": {
      "creds": PostmarkCreds
    },
    "filters":{
      "beforeWrite": [setReplyTo]
    },
    "validations": {
      "from"    : [validations.present, validations.email],
      "to"      : [validations.present, validations.email],
      "subject" : [validations.present],
      "body"    : [validations.present]
    }
  })
  
  // Write the Record
  message.constructor.prototype.write = function(identifier, obj, cb){
    // send message here
    
    var body = {
      "To"        : obj.to,
      "From"      : obj.from,
      "Subject"   : obj.subject,
      "TextBody"  : obj.body,
      "ReplyTo"   : obj.reply_to
    }

    var args = {
      "method"  : "POST",
      "url"     : "http://api.postmarkapp.com/email",
      "body"    : JSON.stringify(body),
      "headers" : {
        "Accept"                  : "application/json",
        "Content-Type"            : "application/json",
        "X-Postmark-Server-Token" : PostmarkCreds.token
      }
    }

    if(process.env.NODE_ENV == "production"){
      request(args, function(e, r, b){
        if(r.statusCode == 200){
          cb(null, obj)
        }else{
          cb(b)
        }
      })      
    }else{
      console.log("email...")
      console.log(body)
      console.log("")
      cb(null, obj)
    }

  }
  
  return message
}
