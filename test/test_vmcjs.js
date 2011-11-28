var assert = require('assert');
var util = require('util');
var vmcjs = require("vmcjs");
var fs = require('fs');
var async = require('async');

var target = process.env.CF_TARGET || assert.fail('CF_TARGET not set, please set in your environment');
var email = process.env.CF_EMAIL || assert.fail('CF_EMAIL not set, please set in your environment');
var pwd = process.env.CF_PWD || assert.fail('CF_PWD not set, please set in your environment');
var adminEmail = process.env.CF_ADMIN_EMAIL || assert.fail('CF_ADMIN_EMAIL not set, please set in your environment');
var adminPwd = process.env.CF_ADMIN_PWD || assert.fail('CF_ADMIN_PWD not set, please set in your environment');

module.exports = {

  'test info': function(){
    var vmc = new vmcjs.VMC(target, email, pwd);
    vmc.info(function(err, info){
      assert.equal(err, undefined, "Unexpected err in info: " + util.inspect(err));
      assert.equal(info.description, "VMware\'s Cloud Application Platform");
    });
  },

  'test userInfo': function(){
    var vmc = new vmcjs.VMC(target, email, pwd);
    vmc.login(function(err, token) {
      assert.equal(err, undefined, "Unexpected err in login: " + util.inspect(err));
      vmc.userInfo(email, function(err, info) {
        assert.equal(err, undefined, "Unexpected err in userInfo: " + util.inspect(err));
        assert.equal(info.email, email);
      });
    });
  },

  'test basic target/login & list apps' : function() {
    var vmc = new vmcjs.VMC(target, email, pwd);
    vmc.login(function(err, token) {
      assert.equal(err, undefined, "Unexpected err in login: " + util.inspect(err));
      vmc.apps(function(err, apps) {
        assert.equal(err, undefined, "Unexpected err in apps: " + util.inspect(err));
      });
    });
  },

  'test push and update' : function() {
    var vmc = new vmcjs.VMC(target, email, pwd);
    vmc.login(function(err, token) {
      assert.equal(err, undefined, "Unexpected err in login: " + util.inspect(err));
      var appName = 'test3';
      var appDir = './fixtures/helloworld';

      // delete our test app if already exists (purposely ignore any errors)
      vmc.deleteApp(appName, function(err, data){
        vmc.push(appName, appDir, function(err) {
          assert.equal(err, undefined, "Unexpected err in push: " + util.inspect(err));

          var serviceName = 'redis-' + appName;
          var vendor = 'redis';
          vmc.createService(serviceName, vendor, function(err, data) {
            assert.equal(err, undefined, "Unexpected err in createService: " + util.inspect(err));
            vmc.bindService(serviceName, appName, function(err, data) {
              assert.equal(err, undefined, "Unexpected err in bindService: " + util.inspect(err));
              testEnv(vmc, appName, function(err){
                vmc.start(appName, function(err, data){
                  assert.equal(err, undefined, "Unexpected err in start: " + util.inspect(err));
                  testAppOk(vmc, appName, serviceName, function(err){
                    // finally test update
                    vmc.update(appName, appDir, function(err, data) {
                      assert.equal(err, undefined, "Unexpected err in update: " + util.inspect(err));
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  },

  'test push and update by proxy user': function(){
    var vmc = new vmcjs.VMC(target, email, pwd);
    var adminVmc = new vmcjs.VMC(target, adminEmail, adminPwd);
    vmc.login(function(err, token){
      assert.equal(err, undefined, "Unexpected err in login: " + util.inspect(err));
      adminVmc.login(function(err, token){
        assert.equal(err, undefined, "Unexpected err in login: " + util.inspect(err));
        // set proxy user
        adminVmc.proxyUser = email;
        var appName = 'test-proxy-user';
        var appDir = './fixtures/helloworld';
        // delete app if exists as normal user.
        vmc.deleteApp(appName, function(err, data){
          // push app as admin user but it is pushed on the normal user
          adminVmc.push(appName, appDir, function(err) {
            assert.equal(err, undefined, "Unexpected err in push: " + util.inspect(err));
            // the normal user can start app deployed by adminVmc
            vmc.start(appName, function(err, data){
              assert.equal(err, undefined, "Unexpected err in start: " + util.inspect(err));
              // finally test update
              vmc.update(appName, appDir, function(err, data) {
                assert.equal(err, undefined, "Unexpected err in update: " + util.inspect(err));
              });
            });
          });
        });

      });
    });
  },

  'test services' : function() {
    var vmc = new vmcjs.VMC(target, email, pwd);
    vmc.login(function(err, token) {
      assert.equal(err, undefined, "Unexpected err in login: " + util.inspect(err));
      var service = 'Redis-112345';
      var vendor = 'redis';
      vmc.createService(service, vendor, function(err, data) {
        assert.equal(err, undefined, "Unexpected err in createService: " + util.inspect(err));
        vmc.deleteService(service, function(err, data){
          assert.equal(err, undefined, "Unexpected err in deleteService: " + util.inspect(err));
        });
      });
    });
  },

  'test createApp in series..' : function() {
    var vmc = new vmcjs.VMC(target, email, pwd);
    var appDir = './fixtures/helloworld';

    createApp(vmc, 'db1', appDir, function(err, results){
      assert.equal(err, undefined, "Unexpected err in createApp: " + util.inspect(err));
    });
  },

  'test bad credentials..' : function() {
    var gotError = false;
    try {
      var vmc = new vmcjs.VMC(undefined, undefined, undefined);
    } catch (x) {
      gotError = true;
    }
    assert.ok(gotError);
  },

  'test update nonexistent app..' : function() {
    var vmc = new vmcjs.VMC(target, email, pwd);
    vmc.login(function(err, token) {
      assert.equal(err, undefined, "Unexpected err in login: " + util.inspect(err));
      var appDir = './fixtures/helloworld';
      vmc.update('ihopefullydontexist', appDir, function(err, app) {
        assert.equal(err.status, 404, "Expected err to return a 404");
      });
    });
  },
/* TODO - add vmc.logs functionality.
  'test logs' : function() {
    var vmc = new vmcjs.VMC(target, email, pwd);
    var appDir = './fixtures/helloworld';

    createApp(vmc, 'kn1', appDir, function(err, results){
      assert.equal(err, undefined, "Unexpected err in createApp: " + util.inspect(err));
      vmc.logs('kn1', {all: true}, function(err, logs){
  console.log("logs: " + util.inspect(logs))
        
      });
    });
  }
*/
};

function testEnv(vmc, appName, callback) {
  vmc.addEnv(appName, "FOO", "BAR", function(err, data) {
    assert.equal(err, undefined, "Unexpected err in addEnv: " + util.inspect(err));
    vmc.env(appName, function(err, environment) {
      assert.equal(err, undefined, "Unexpected err in env: " + util.inspect(err));
      vmc.delEnv(appName, "FOO", function(err, data){
        assert.equal(err, undefined, "Unexpected err in delEnv: " + util.inspect(err));
        callback(undefined);
      });
    });
  });
};

function testAppOk(vmc, appName, service, callback) {
  vmc.appInfo(appName, function(err, app){
    assert.equal(err, undefined, "Unexpected err in appInfo: " + util.inspect(err));
    assert.equal(app.state, 'STARTED', 'App not started: ' + util.inspect(app));
    assert.notEqual(app.services.indexOf(service), -1, "App doesn't have service: " + service + " " + util.inspect(app));
    vmc.appStats(appName, function(err, app){
      assert.equal(err, undefined, "Unexpected err in appStats: " + util.inspect(err));
      callback(undefined);
    });
  });
};

// run a bunch of calls in series.. test will fail if any return an error
function createApp(vmc, appName, appDir, cb) {
  async.series([
    function(callback) { vmc.login(callback);},
    function(callback) { vmc.deleteApp(appName, function(err, data){ callback();});}, // ignore any error from delete
    function(callback) { vmc.push(appName, appDir, callback);},
    function(callback) { vmc.createService('redis-' + appName, 'redis', callback);},
    function(callback) { vmc.bindService('redis-' + appName, appName, callback);},
    function(callback) { vmc.start(appName, callback);},
    function(callback) { vmc.addEnv(appName, 'variable1', 'value1', callback);},
    function(callback) { vmc.delEnv(appName, 'variable1', callback);}
  ], cb);
};