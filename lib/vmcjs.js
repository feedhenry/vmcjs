var util = require('util');
var http = require('http');
var async = require('async');
var url = require('url');
var comms = require('./comms.js');
var vmcutils = require('./vmcutils.js');

// Get CloudFoundry Information
VMC.prototype.info = function(callback) {
  var path = '/info';
  this.get(path, function(err, data) {
    return callback(err, data);
  });
};

// Get CloudFoundry User infomration
VMC.prototype.userInfo = function(email, callback){
  var path = '/users/' + email;
  this.get(path, function(err, data) {
    return callback(err, data);
  });
};

// Add a new user on Cloud Foundry
VMC.prototype.addUser = function(email, password, callback){
   var path = '/users/';
   var args = {email: email, password: password};
   this.post(path, args, function(err, data){
      return callback(err, data);
   });
};

// Delete a user from Cloud Foundry
VMC.prototype.deleteUser = function(email, callback){
   var path = '/users/' + email;
   this.del(path, function(err, data){
      return callback(err, data);
   });
};


// Get CloudFoundry App infomation
VMC.prototype.appInfo = function(name, callback) {
  var path = '/apps/' + name;
  this.get(path, function(err, data) {
    return callback(err, data);
  });
};

// Get CloudFoundry App stats
VMC.prototype.appStats = function(name, callback) {
  var path = '/apps/' + name + '/stats';
  this.get(path, function(err, data) {
    return callback(err, data);
  });
};

// Get all our CloudFoundry Apps..
VMC.prototype.apps = function(callback) {
  var path = '/apps';
  this.get(path, callback);
};

// Updates an Apps details
VMC.prototype.updateApp = function(name, app, callback) {
  var path = '/apps/' + name;
  this.put(path, app, callback);
};

// Start App
VMC.prototype.start = function(name, callback) {
  var self = this;
  this.appInfo(name, function(err, app){
    if(err) return callback(err);
    app.state = 'STARTED';
    self.updateApp(name, app, function(err, data){
      if (err) return callback(err);
      return callback(undefined, app);
    });
  });
};

// Stop App
VMC.prototype.stop = function(name, callback) {
  var self = this;
  this.appInfo(name, function(err, app){
    if(err) return callback(err);
    app.state = 'STOPPED';
    self.updateApp(name, app, callback);
  });
};

// Restart App
VMC.prototype.restart = function(name, callback) {
  var self = this;
  this.stop(name, function(err, data) {
    if (err) return callback(err);
    self.start(name, callback);
  });
};

// Get CF System Services
VMC.prototype.systemServices = function(callback) {
  this.get('/info/services', callback);
};

// Get CF Provisioned Services
VMC.prototype.provisionedServices = function(callback) {
  this.get('/services', callback);
};

// Create a new Provisioned Service
VMC.prototype.createService = function(service, vendor, callback) {
  var self = this;
  this.systemServices(function(err, services){
    var vendorService = vmcutils.vendorService(services, vendor);
    if (vendorService == undefined) return callback(new Error('System Service not found: ' + vendor));
    var serviceHash = vmcutils.serviceHash(vendorService, service);
    self.post('/services', serviceHash, callback);
  });
};

// Delete existing Provisioned Service
VMC.prototype.deleteService = function(service, callback) {
  var self = this;
  this.provisionedServices(function(err, services){
    var serviceNames = [];
    for (var i=0; i<services.length; i++) {
      var serv = services[i];
      serviceNames.push(serv.name);
    }

    if(serviceNames.indexOf(service) == -1) return callback(new Error('Service not found: ' + service));

    self.del('/services/' + service, callback);
  });
};

// Bind an App to a Service
VMC.prototype.bindService = function(service, appName, callback) {
  var self = this;
  this.appInfo(appName, function(err, app){
    if(err) return callback(err);
    app.services.push(service);
    self.updateApp(appName, app, function(err, data){
      if (err) return callback(err);
      return callback(undefined, app);
    });
  });
};

// Push App to CloudFoundry
VMC.prototype.push = function(name, dir, callback) {
  var self = this;
  if (!require('path').existsSync(dir)) return callback(new Error('Directory does not exist: ' + dir));

  this.appInfo(name, function(err, app){
    if(err && err.status !== 404) return callback(err);
    if(app) return callback(new Error("App: " + name +" already exists, use 'update' instead"));

    // TODO - check app limits/capacity/etc (all checks in apps.rb.push
    var path = '/apps';
    var manifest = {resources: {
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

    self.post(path, manifest, function(err, data){
      if (err) return callback(err);
      self.upload(dir, name, callback);
    });
  });
};

// Update existing App
VMC.prototype.update = function(name, dir, callback) {
  var self = this;
  if (!require('path').existsSync(dir)) return callback(new Error('Directory does not exist: ' + dir));

  this.appInfo(name, function(err, app){
    if(err) return callback(err);
    // TODO - check app limits/capacity/etc (all checks in apps.rb.push
    self.upload(dir, name, function(err, data){
      if(err) return callback(err);
      self.restart(name, callback);
    });
  });
};

// Delete App.. deletes any provisioned services also
// TODO - pass flag to not delete an apps services by default..
VMC.prototype.deleteApp = function(name, callback) {
  var self = this;
  this.appInfo(name, function(err, app){
    if(err) return callback(err);

    var deleteService = function(service, callback) {
      self.deleteService(service, callback);
    };

    async.map(app.services, deleteService, function(err, results){
      if(err) return callback(err);

      var path = '/apps/' + name;
      self.del(path, callback);
    });
  });
};

// Get App environment variables
VMC.prototype.env = function(name, callback) {
  this.appInfo(name, function(err, app){
    if(err) return callback(err);
    return callback(undefined, app.env, app);
  });
};

// Add environment variable to App. Note restarts app if already running
VMC.prototype.addEnv = function(name, variable, value, callback) {
  var self = this;
  this.appInfo(name, function(err, app){
    if(err) return callback(err);
    var env = variable + "=" + value;
    app.env.push(env);

    self.updateApp(name, app, function(err, data){
      if (err) return callback(err);
      if(app.state == 'STARTED') {
        self.restart(name, callback);
      }else {
        callback(undefined, app.env);
      }
    });
  });
};

// Delete App environment variable. Note restarts app if already running.
VMC.prototype.delEnv = function(name, variable, callback) {
  var self = this;
  this.env(name, function(err, env, app){
    if (err) return callback(err);

    var newEnv = [];
    for(var i=0; i<env.length; i++) {
      var nvp = env[i];
      var nv = nvp.split('=');
      if(nv[0] !== variable) newEnv.push(nvp);
    }

    app.env = newEnv;
    self.updateApp(name, app, function(err, data){
      if (err) return callback(err);
      if(app.state == 'STARTED') {
        self.restart(name, callback);
      }else {
        callback(undefined, app.env);
      }
    });
  });
};

// Login to CloudFoundry
VMC.prototype.login = function(callback) {
  var self = this;
  this.token = undefined;
  var path = '/users/' + this.user + '/tokens';
  var params = {password: this.pwd};

  self.post(path, params, function(err, resp) {
    if(err) return callback(err);
    self.token = resp.token;
    return callback(undefined, resp.token);
  });
};

// 'Constructor' function
function VMC(target, user, pwd) {
  if (target == undefined || user == undefined || pwd == undefined) {
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
  this.token = undefined;
  this.proxyUser = undefined;

  this.get = function(path, callback) {
    return comms.request('GET', this.host, this.port, this.isSecure, path, undefined, { token: this.token, proxyUser: this.proxyUser }, callback);
  };

  this.post = function(path, params, callback) {
    return comms.request('POST', this.host, this.port, this.isSecure, path, params, { token: this.token, proxyUser: this.proxyUser }, callback);
  };
  this.put = function(path, params, callback) {
    return comms.request('PUT', this.host, this.port, this.isSecure, path, params, { token: this.token, proxyUser: this.proxyUser }, callback);
  };
  this.del = function(path, callback) {
    return comms.request('DELETE', this.host, this.port, this.isSecure, path, undefined, { token: this.token, proxyUser: this.proxyUser }, callback);
  };
  this.uploadZip = function(zipFile, path, resources, callback) {
    return comms.upload(this.host, this.port, this.isSecure, { token: this.token, proxyUser: this.proxyUser }, zipFile, path, resources, callback);
  };

  // Note: the following requires that 'zip' is available in your path
  this.upload = function(dir, name, callback) {
    var self = this;

    // TODO - get system tmp dir
    var zipFile = '/tmp/' + name + '.zip';

    if(require('path').existsSync(zipFile))
      require('fs').unlinkSync(zipFile);

    vmcutils.zip(dir, zipFile, function(err, data){
      if (err) return callback(err);
      var path = '/apps/' + name + '/application';
      self.uploadZip(zipFile, path, '[]', callback);
    });
  };
};

exports.VMC = VMC;

