var listen  = process.env.LISTEN  || 5001

var rolodex = require("../")({
  "role": "master"
})

rolodex.listen(listen)