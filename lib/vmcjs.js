var util = require('util');
var http = require('http');
var async = require('async');
var url = require('url');
var comms = require('./comms.js');
var vmcutils = require('./vmcutils.js');

VMC.prototype.appInfo = function(name, callback) {
  var path = '/apps/' + name;
  this.get(path, function(err, data) {
    return callback(err, data);
  });
};

VMC.prototype.apps = function(callback) {
  var path = '/apps';
  this.get(path, callback);
};

VMC.prototype.updateApp = function(name, app, callback) {
  var path = '/apps/' + name;
  this.put(path, app, callback);
};

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

VMC.prototype.stop = function(name, callback) {
  var self = this;
  this.appInfo(name, function(err, app){
    if(err) return callback(err);
    app.state = 'STOPPED';
    self.updateApp(name, app, callback);
  });
};

VMC.prototype.restart = function(name, callback) {
  var self = this;
  this.stop(name, function(err, data) {
    if (err) return callback(err);
    self.start(name, callback);
  });  
};

VMC.prototype.systemServices = function(callback) {
  this.get('/info/services', callback);
};

VMC.prototype.provisionedServices = function(callback) {
  this.get('/services', callback);
};

VMC.prototype.createService = function(service, vendor, callback) {
  var self = this;
  this.systemServices(function(err, services){  
    var vendorService = vmcutils.vendorService(services, vendor);
    if (vendorService == undefined) return callback(new Error('System Service not found: ' + vendor));
    var serviceHash = vmcutils.serviceHash(vendorService, service);
    self.post('/services', serviceHash, callback);
  });
};

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

VMC.prototype.push = function(name, dir, callback) {
  var self = this;
  // TODO - error checking dir, etc..
  // TODO - needs 'app_exits' equivalent
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
    uris:[name + self.rootTarget] // TODO
  };

  this.post(path, manifest, function(err, data){
    if (err) return callback(err);
    self.upload(dir, name, callback);
  });
};

VMC.prototype.update = function(dir, name, callback) {
  var self = this;
  // TODO - error checking dir, etc..
  // TODO - needs 'app_exits' equivalent
  // TODO - check app limits/capacity/etc (all checks in apps.rb.push
  self.upload(dir, name, function(err, data){
    if(err) return callback(err);
    //console.log("UPDATE APP BITS: " + util.inspect(data));
    self.restart(name, callback);
  });  
};

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

VMC.prototype.env = function(name, callback) {
  this.appInfo(name, function(err, app){
    if(err) return callback(err);
    return callback(undefined, app.env, app);
  });
};

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

function VMC(target, user, pwd) {
  if (target == undefined || user == undefined || pwd == undefined) {
    throw new Error("Target/User/Pwd not specified: target: " + target + " user: " + user + " pwd: " + pwd);
  }

  var uri = url.parse(target);
  if (uri.protocol == undefined) throw new Error('Please specify fully target url, e.g. http://api.vcap.me');
  if (target.indexOf('api') == -1) throw new Error('Please specify fully target url, e.g. http://api.vcap.me');

  this.isSecure = uri.protocol === 'https' ? true : false;  
  
  if (uri.port == undefined) {
    this.port = uri.protocol === 'https' ? 443 : 80;
  }else {
    this.port = uri.port;
  }
  this.host = uri.hostname;
  this.rootTarget = uri.hostname.replace('api', ''); // TODO - good enough?

  this.target = target;
  this.user = user;
  this.pwd = pwd;
  this.token = undefined;  
  
  this.get = function(path, callback) {
    return comms.request('GET', this.host, this.port, this.isSecure, path, undefined, this.token, callback);
  };

  this.post = function(path, params, callback) {
    return comms.request('POST', this.host, this.port, this.isSecure, path, params, this.token, callback);
  };
  this.put = function(path, params, callback) {
    return comms.request('PUT', this.host, this.port, this.isSecure, path, params, this.token, callback);
  };
  this.del = function(path, callback) {
    return comms.request('DELETE', this.host, this.port, this.isSecure, path, undefined, this.token, callback);
  };
  this.uploadZip = function(zipFile, path, resources, callback) {
    return comms.upload(this.host, this.port, this.isSecure, this.token, zipFile, path, resources, callback);
  };

  this.upload = function(dir, name, callback) {
    var self = this;

    // TODO - get system tmp dir
    var zipFile = '/tmp/' + name + '.zip';
    vmcutils.zip(dir, zipFile, function(err, data){
      if (err) return callback(err);
      var path = '/apps/' + name + '/application';
      self.uploadZip(zipFile, path, '[]', callback);
    });
  };
};

exports.VMC = VMC;

