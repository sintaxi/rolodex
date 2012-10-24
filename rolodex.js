var redis   = require("redis")
var request  = require("request")

module.exports = function(options) {
  if(!options) options = {}
  
  // TODO: improve this feedback message
  
  // need role config in production
  if(!options.hasOwnProperty("role")){
    throw "<role> required in configuration"
  }
  
  // need email config in production
  if(process.env.NODE_ENV === "production"){
    if(!options.hasOwnProperty("email")){
      throw "<email> required in configuration in production mode."
    }
  }
  
  var rolodex = {}
  
  if(options.hasOwnProperty("role") && options["role"] == "slave"){
    // slave
    
    var remote = function(endpoint){
      var endpoint = endpoint;
      return function(){
        var args = Array.prototype.slice.call(arguments)
        var callback = args.pop()  
        var ops = {
          "method"  : "POST",
          "url"     : options.master + endpoint,
          "body"    : JSON.stringify(args),
          "headers" : {
            "Accept"                  : "application/json",
            "Content-Type"            : "application/json"
          }
        }
        request(ops, function(e, r, b){
          var reply = JSON.parse(b)
          if(r.statusCode == 200){
            callback.apply(this, reply)
          }
        })
      }
    }
    
    rolodex.account = {
      set:          remote("/account/set"),
      get:          remote("/account/get"),
      validate:     remote("/account/validate"),
      authenticate: remote("/account/authenticate"),
      group:        remote("/account/group"),
      all:          remote("/account/all"),
      email:        remote("/account/email")
    }
    
  }else{
    // master
    options.store = options.store || {}
    options.email = options.email || {}
    
    var client = redis.createClient(options.redis)
    
    rolodex.account = require("./models/account")({
      client: client,
      email : options.email
    })
    
    rolodex.listen = function(args){
      var connect = require('connect')
      var http    = require('http')
      var app = connect()
        .use(connect.bodyParser())
        .use(function(req, rsp, next){
          var a = req.url.split("/")
          req.rolodexMethod     = a.pop()
          req.roloxexNamespace  = a.pop()
          next()
        })
        .use(function(req, rsp){
          var args = req.body
          args.push(function(){
            rsp.end(JSON.stringify(Array.prototype.slice.call(arguments)))
          })
          rolodex[req.roloxexNamespace][req.rolodexMethod].apply(this, args)
        })
      http.createServer(app).listen(args, function(){
        console.log("Rolodex Master is listening on port", args)
      })
    }
  }
  
  return rolodex
}
