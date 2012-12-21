var port  = process.env.PORT || 5001

var rolodex = require("../")({
  "role": "slave",
  "master": "http://foo:bar@127.0.0.1:" + port,
  "auth": {
    "user": "foo",
    "pass": "baz"
  }
})

rolodex.listen(port + 1, function(){
  console.log("connecting to port", port)
  console.log("listening on port", port + 1)
})