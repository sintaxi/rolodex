var request     = require("request")
var Thug        = require("thug")
var validations = require("../lib/validations")

var setFrom = function(obj, next){
  if(!obj.hasOwnProperty("from")){
    obj.from = this.locals.defaults.from || ""
  }
  next(obj)
}

var setReplyTo = function(obj, next){
  if(!obj.hasOwnProperty("reply_to")){
    obj.reply_to = this.locals.defaults.reply_to || obj.from
  }
  next(obj)
}

/*
  {
     "defaults": {
       "reply_to": "...",
       "from": "..."
     }
     "postmark": { token: "..." }
  }
*/
module.exports = function(config) {
  config          = config || {}
  config.defaults = config.defaults || {}
  config.postmark = config.postmark || {}

  var message = new Thug({
    "locals": config,
    "filters":{
      "beforeValidate": [setFrom, setReplyTo]
    },
    "validations": {
      "from"    : [validations.present, validations.email],
      "to"      : [validations.present, validations.email],
      "reply_to": [validations.present, validations.email],
      "subject" : [validations.present],
      "body"    : [validations.present]
    }
  })

  // Write the Record
  message.constructor.prototype.write = function(identifier, obj, cb){
    // send message here

    // let slave pass in postmark token
    if(obj.hasOwnProperty("postmark")){
      var postmark = obj.postmark
      delete obj.postmark
    }else{
      var postmark = this.locals.postmark
    }

    var body = {
      "To"        : obj.to,
      "From"      : obj.from,
      "Subject"   : obj.subject,
      "TextBody"  : obj.body,
      "ReplyTo"   : obj.reply_to,
      "HtmlBody"  : obj.body_html
    }

    var args = {
      "method"  : "POST",
      "url"     : "https://api.postmarkapp.com/email",
      "body"    : JSON.stringify(body),
      "headers" : {
        "Accept"                  : "application/json",
        "Content-Type"            : "application/json",
        "X-Postmark-Server-Token" : postmark
      }
    }

    if(["development", "production"].indexOf(process.env.NODE_ENV) !== -1) {
      request(args, function(e, r, b){
        if(r.statusCode == 200){
          cb(obj)
        }else{
          cb(null)
        }
      })

      if(process.env.NODE_ENV == "development"){
        console.log("\n", "-----------", "\n")
        console.log("  subject:", obj.subject)
        console.log("       to:", obj.to)
        console.log("     from:", obj.from)
        console.log()
        console.log(obj.body)
        console.log()
      }
    } else {
      cb(obj)
    }

  }

  return message
}
