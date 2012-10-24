var listen  = process.env.LISTEN  || 5001

var rolodex = require("../")({
  "role": "master",
  "email": {
    "defaults": { 
      "from": "info@chloi.io"
    },
    "postmark": "c34e1598-d371-4809-a418-6aac7cc8a03b"
  },
  "auth": {
    "user": "foo",
    "pass": "bar"
  }
})

rolodex.listen(listen)