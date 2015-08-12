var redis   = require("redis")
var request  = require("request")

module.exports = function(options, redisClient) {
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
          if(r.statusCode == 200){
            var reply = JSON.parse(b)
            callback.apply(this, reply)
          }else{
            callback.call()
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
      email:        remote("/account/email"),
      promote:      remote("/account/promote"),
      del:          remote("/account/del"),
      token:        remote("/account/token"),
      authtoken:    remote("/account/authtoken")
    }

    rolodex.listen = function(){
      var connect = require('connect')
      var http    = require('http')
      var app = connect()
        .use(connect.basicAuth(options.auth.user, options.auth.pass))
        .use(connect.bodyParser())
        .use(function(req, rsp){
          var ops = {
            "method"  : "POST",
            "url"     : options.master + req.url,
            "body"    : JSON.stringify(req.body),
            "headers" : {
              "Accept"                  : "application/json",
              "Content-Type"            : "application/json"
            }
          }
          request(ops, function(e, r, b){
            if(r.statusCode == 200){
              rsp.end(b)
            }
          })
        })
      var server = http.createServer(app)
      server.listen.apply(server, arguments)
    }

  }else{
    // master
    options.store = options.store || {}
    options.email = options.email || {}
    options.auth  = options.auth  || {
      user: "default",
      pass: "secret"
    }
    var client = redisClient || redis.createClient(options.redis)

    rolodex.account = require("./models/account")({
      client: client,
      email : options.email
    })

    rolodex.email = function(args, cb) {

      options       = options || {};
      options.email = options.email || {}

      var message = require("./models/message")(options.email);

      var args = {
        to: args.to,
        subject:args.subject,
        body:args.body,
        body_html:args.body_html
      }

      message.set(args, function(errors, reply){
        cb(errors, reply)
      });

    }

    rolodex.listen = function(){
      var ar = arguments
      var connect = require('connect')
      var app = connect()
        .use(connect.basicAuth(options.auth.user, options.auth.pass))
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

      if(options.hasOwnProperty("ssl")) {

        var fs = require('fs')
        var https = require('https')

        if(!options.ssl.hasOwnProperty("cert")) {
          throw "<ssl.cert> required in configuration when using ssl"
        }
        if(!options.ssl.hasOwnProperty("key")) {
          throw "<ssl.key> required in configuration when using ssl"
        }

        var privateKey = fs.readFileSync(options.ssl.key, 'utf-8')
        var certificate = fs.readFileSync(options.ssl.cert, 'utf-8')

        var server = https.createServer({
          "key": privateKey,
          "cert": certificate
        }, app)
      }

      else {

        var http = require('http')
        var server = http.createServer(app)
      }

      server.listen.apply(server, arguments)
    }
  }

  return rolodex
}
