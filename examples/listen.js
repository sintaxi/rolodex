var role    = process.env.ROLE    || null
var connect = process.env.CONNECT || null
var listen  = process.env.LISTEN  || 5001

var rolodex = require("../")({ role: role, port: connect })

rolodex.listen(listen)