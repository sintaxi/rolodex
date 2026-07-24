var http  = require("http")
var https = require("https")
var url   = require("url")

// drop-in for the retired request package, covering the one shape
// rolodex uses: POST with a string body. fires callback(err, response, body).
// on network error the response carries statusCode 0 so callers checking
// r.statusCode treat it as a failed send.
module.exports = function(ops, callback){
  var target = url.parse(ops.url)
  var lib    = target.protocol === "https:" ? https : http

  var req = lib.request({
    "hostname" : target.hostname,
    "port"     : target.port,
    "path"     : target.path,
    "method"   : ops.method || "POST",
    "headers"  : ops.headers
  }, function(rsp){
    var chunks = []
    rsp.on("data", function(chunk){ chunks.push(chunk) })
    rsp.on("end", function(){
      callback(null, rsp, Buffer.concat(chunks).toString())
    })
  })

  req.on("error", function(err){
    callback(err, { statusCode: 0 }, null)
  })

  req.end(ops.body)
}
