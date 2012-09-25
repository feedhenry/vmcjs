var util = require('util');
var http = require('http');
var async = require('async');
var url = require('url');
var comms = require('./comms.js');
var vmcutils = require('./vmcutils.js');

// Get CloudFoundry Information
VMC.prototype.info = function(options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var path = '/info';
  this.get(path, options, function(err, data) {
    return callback(err, data);
  });
};

// Get CloudFoundry User infomration
VMC.prototype.userInfo = function(email, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var path = '/users/' + email;
  this.get(path, options, function(err, data) {
    return callback(err, data);
  });
};

// Add a new user on Cloud Foundry
VMC.prototype.addUser = function(email, password, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var path = '/users/';
  var args = {email: email, password: password};
  this.post(path, args, options, function(err, data) {
    return callback(err, data);
  });
};

// Delete a user from Cloud Foundry
VMC.prototype.deleteUser = function(email, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var path = '/users/' + email;
  this.del(path, options, function(err, data) {
    return callback(err, data);
  });
};


// Get CloudFoundry App infomation
VMC.prototype.appInfo = function(name, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var path = '/apps/' + name;
  this.get(path, options, function(err, data) {
    return callback(err, data);
  });
};

// Get CloudFoundry App stats
VMC.prototype.appStats = function(name, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var path = '/apps/' + name + '/stats';
  this.get(path, options, function(err, data) {
    return callback(err, data);
  });
};

// Get all our CloudFoundry Apps..
VMC.prototype.apps = function(options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var path = '/apps';
  this.get(path, options, callback);
};

// Updates an Apps details
VMC.prototype.updateApp = function(name, app, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var path = '/apps/' + name;
  this.put(path, app, options, callback);
};

// Start App
VMC.prototype.start = function(name, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.appInfo(name, options, function(err, app) {
    if (err) return callback(err);
    app.state = 'STARTED';
    self.updateApp(name, app, options, function(err, data) {
      if (err) return callback(err);
      return callback(undefined, app);
    });
  });
};

// Stop App
VMC.prototype.stop = function(name, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.appInfo(name, options, function(err, app) {
    if (err) return callback(err);
    app.state = 'STOPPED';
    self.updateApp(name, app, options, callback);
  });
};

// Restart App
VMC.prototype.restart = function(name, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.stop(name, options, function(err, data) {
    if (err) return callback(err);
    self.start(name, options, callback);
  });
};

// Get CF System Services
VMC.prototype.systemServices = function(options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  this.get('/info/services', options, callback);
};

// Get CF Provisioned Services
VMC.prototype.provisionedServices = function(options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  this.get('/services', options, callback);
};

// Create a new Provisioned Service
VMC.prototype.createService = function(service, vendor, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.systemServices(options, function(err, services){
    var vendorService = vmcutils.vendorService(services, vendor);
    if (vendorService == undefined) return callback(new Error('System Service not found: ' + vendor));
    var serviceHash = vmcutils.serviceHash(vendorService, service);
    self.post('/services', serviceHash, options, callback);
  });
};

// Delete existing Provisioned Service
VMC.prototype.deleteService = function(service, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.provisionedServices(options, function(err, services){
    if( err ){
      return callback(err, []);
    }else{
      var serviceNames = [];
      for (var i=0; i<services.length; i++) {
        var serv = services[i];
        serviceNames.push(serv.name);
      }
      if(serviceNames.indexOf(service) == -1) return callback(new Error('Service not found: ' + service));

      self.del('/services/' + service, options, callback);
    }
  });
};

// Bind an App to a Service
VMC.prototype.bindService = function(service, appName, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.appInfo(appName, options, function(err, app){
    if(err) return callback(err);
    app.services.push(service);
    self.updateApp(appName, app, options, function(err, data){
      if (err) return callback(err);
      return callback(undefined, app);
    });
  });
};

// Unbind an app from a service
VMC.prototype.unbindService = function(service, appName, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
	  this.appInfo(appName, options, function(err, app){
	    if(err) return callback(err);
		newServices = [];
		for (var i=0; i<app.services.length; i++) {
			if (app.services[i] != service){
				newServices.push(app.services[i]);
			}
		}
		app.services = newServices;
		self.updateApp(appName, app, options, function(err, data){
	      if (err) return callback(err);
	      return callback(undefined, app);
	    });
	});
};

// Map a URL to an app
VMC.prototype.map = function(appName, URL, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.appInfo(appName, options, function(err, app) {
    if (err) return callback(err);
    app.uris.push(URL);
    self.updateApp(appName, app, options, function(err, data) {
      if (err) return callback(err);
      return callback(undefined, app);
    });
  });
};

// Unmap a URL from an app
VMC.prototype.unmap = function(appName, URL, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.appInfo(appName, options, function(err, app) {
    if (err) return callback(err);
    newURLs = [];
    for (var i = 0; i < app.uris.length; i++) {
      if (app.uris[i] != URL) {
        newURLs.push(app.uris[i]);
      }
    }
    app.uris = newURLs;
    self.updateApp(appName, app, options, function(err, data) {
      if (err) return callback(err);
      return callback(undefined, app);
    });
  });
};

// Push App to CloudFoundry
VMC.prototype.push = function(name, dir, manifest, options, callback) {
  var self = this;
  if (typeof(options) === 'function') {
    callback = options;
    options = undefined;
  } else if (typeof(manifest) === 'function') {
    callback = manifest;
    manifest = {
      resources: {
        memory:64
      },
      instances:1,
      name: name,
      staging:{
        framework:'node',
        runtime: null
      },
      uris:[name + self.rootTarget]
    };
    options = undefined;
  }
  if (name !== manifest.name) {
    return callback(new Error('Specified name is different from name in manifest. '));
  }

  if (!require('path').existsSync(dir)) return callback(new Error('Directory does not exist: ' + dir));

  this.appInfo(name, function(err, app){
    if(err && err.status !== 404) return callback(err);
    if(app) return callback(new Error("App: " + name +" already exists, use 'update' instead"));

    // TODO - check app limits/capacity/etc (all checks in apps.rb.push
    var path = '/apps';
    self.post(path, manifest, options, function(err, data){
      if (err) return callback(err);
      self.upload(dir, name, options, callback);
    });
  });
};

// Update existing App
VMC.prototype.update = function(name, dir, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  if (!require('path').existsSync(dir)) return callback(new Error('Directory does not exist: ' + dir));

  this.appInfo(name, function(err, app){
    if(err) return callback(err);
    // TODO - check app limits/capacity/etc (all checks in apps.rb.push
    self.upload(dir, name, options, function(err, data){
      if(err) return callback(err);
      self.restart(name, options, callback);
    });
  });
};

// Delete App.. deletes any provisioned services also
VMC.prototype.deleteApp = function(name, delSvcFlag, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  } else if(typeof(delSvcFlag) === 'function' ){
    callback = delSvcFlag;
    delSvcFlag = true; // backward compatibility
    options = undefined;
  }
  var self = this;
  var path = '/apps/' + name;
  this.appInfo(name, options, function(err, app){
    if(err) return callback(err);

    if( delSvcFlag ){
      var deleteService = function(service, callback) {
        self.deleteService(service, options, callback);
      };

      async.map(app.services, deleteService, function(err, results){
        if(err) return callback(err);

        self.del(path, options, callback);
      });
    }else{
      self.del(path, options, callback);
    }
  });
};

// Get App environment variables
VMC.prototype.env = function(name, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  this.appInfo(name, options, function(err, app){
    if(err) return callback(err);
    return callback(undefined, app.env, app);
  });
};

// Add environment variable to App. Note restarts app if already running
VMC.prototype.addEnv = function(name, variable, value, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.appInfo(name, options, function(err, app){
    if(err) return callback(err);
    var env = variable + "=" + value;
    app.env.push(env);

    self.updateApp(name, app, options, function(err, data){
      if (err) return callback(err);
      if(app.state == 'STARTED') {
        self.restart(name, options, callback);
      }else {
        callback(undefined, app.env);
      }
    });
  });
};

// Delete App environment variable. Note restarts app if already running.
VMC.prototype.delEnv = function(name, variable, options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.env(name, options, function(err, env, app){
    if (err) return callback(err);

    var newEnv = [];
    for(var i=0; i<env.length; i++) {
      var nvp = env[i];
      var nv = nvp.split('=');
      if(nv[0] !== variable) newEnv.push(nvp);
    }

    app.env = newEnv;
    self.updateApp(name, app, options, function(err, data){
      if (err) return callback(err);
      if(app.state == 'STARTED') {
        self.restart(name, options, callback);
      }else {
        callback(undefined, app.env);
      }
    });
  });
};

// Login to CloudFoundry
VMC.prototype.login = function(options, callback) {
  if (typeof(options) == 'function') {
    callback = options;
    options = undefined;
  }
  var self = this;
  this.token = undefined;
  var path = '/users/' + this.user + '/tokens';
  var params = {password: this.pwd};
  self.post(path, params, options, function(err, resp) {
    if (err) return callback(err);
    self.token = resp.token;
    return callback(undefined, resp.token);
  });
};

// 'Constructor' function
function VMC(target, user, pwd, token) {
  if (target == undefined || ((user == undefined || pwd == undefined) && token == undefined)) {
    throw new Error("Target/User/Pwd not specified: target: " + target + " user: " + user + " pwd: " + pwd);
  }

  var uri = url.parse(target);
  if (uri.protocol == undefined) throw new Error('Please specify fully target url, e.g. http://api.vcap.me');
  if (target.indexOf('api') == -1) throw new Error('Please specify fully target url, e.g. http://api.vcap.me');

  this.isSecure = uri.protocol === 'https:';

  if (uri.port == undefined) {
    this.port = uri.protocol === 'https:' ? 443 : 80;
  }else {
    this.port = uri.port;
  }
  this.host = uri.hostname;
  this.rootTarget = uri.hostname.replace('api', ''); // TODO - good enough?

  this.target = target;
  this.user = user;
  this.pwd = pwd;
  this.token = token;
  this.proxyUser = undefined;

  //Adds the default options to options, if they don't already exist
  this.getOptions = function(options) {
    options = (options == undefined) ? {} : options;
    options.token = this.token;
    options.proxyUser = this.proxyUser;
    return options;
  };

  this.get = function(path, options, callback) {
    return comms.request('GET', this.host, this.port, this.isSecure, path, undefined, this.getOptions(options), callback);
  };

  this.post = function(path, params, options, callback) {
    return comms.request('POST', this.host, this.port, this.isSecure, path, params, this.getOptions(options), callback);
  };
  this.put = function(path, params, options, callback) {
    return comms.request('PUT', this.host, this.port, this.isSecure, path, params, this.getOptions(options), callback);
  };
  this.del = function(path, options, callback) {
    return comms.request('DELETE', this.host, this.port, this.isSecure, path, undefined, this.getOptions(options), callback);
  };
  this.uploadZip = function(zipFile, path, resources, options, callback) {
    return comms.upload(this.host, this.port, this.isSecure, this.getOptions(options), zipFile, path, resources, callback);
  };

  // Note: the following requires that 'zip' is available in your path
  this.upload = function(dir, name, options, callback) {
    var self = this;

    // TODO - get system tmp dir
    var zipFile = '/tmp/' + name + '.zip';

    var fs = require('fs');
    if (require('path').existsSync(zipFile))
      fs.unlinkSync(zipFile);

    var path = '/apps/' + name + '/application';
    fs.readdir(dir, function(err, files) {
      if (err) return callback(err);
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.indexOf('.war') >= 0) {
          return vmcutils.copy(dir + '/' + file, zipFile, function(err, data) {
            if (err) return callback(err);
            self.uploadZip(zipFile, path, '[]', options, callback);
          });
        }
      }
      vmcutils.zip(dir, zipFile, function(err, data) {
        if (err) return callback(err);
        var path = '/apps/' + name + '/application';
        self.uploadZip(zipFile, path, '[]', options, callback);
      });
    });
  };
}

exports.VMC = VMC;

