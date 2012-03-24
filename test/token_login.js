var vmcjs = require('../lib/vmcjs');

var config = require('./config.json');
var token = config.token;
var username = config.username;
var password = config.password;

// Get info using traditional login
var vmc = new vmcjs.VMC("http://api.cloudfoundry.com", username, password);
vmc.login(function(err) {
	vmc.info(function(err, data){
		console.dir(data.frameworks.node.runtimes[0].version);
	});
});