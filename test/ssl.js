var fs     = require("fs")

var role   = process.env.ROLE || "master"
var config  = JSON.parse(fs.readFileSync(__dirname + "/config/"+ role +".json"))

config.ssl = {
  "cert": __dirname + '/config/certificate.pem',
  "key": __dirname + '/config/privatekey.pem'
};

describe("ssl", function(){  

  it('should initialize with cert and key in config', function(done) {
    require("../")(config).listen(8025, done);
  });
  
})

