if(process.env.ROLE == "master"){
  var fs     = require("fs")
  var config  = require(__dirname + "/config/master.json")

  config.ssl = {
    "cert": __dirname + '/config/certificate.pem',
    "key": __dirname + '/config/privatekey.pem'
  };

  describe("ssl", function(){

    it('should initialize with cert and key in config', function(done) {
      require("../")(config).listen(8025, function(){
        done()
      });
    });

  })
}
