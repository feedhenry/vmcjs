var http = require('http');
var https = require('https');
var util = require('util');
var fs = require('fs');

function request(method, host, port, isSecure, path, params, options, callback) {
  var payload;
  var headers = {};
  if (method !== 'DELETE') {
    headers["accept"] = "application/json";
    headers["content-type"] = "application/json";
  } else {
    // Odd - CloudController delete seems to require that content lenght be set..
    headers["content-length"] = 0;
  }

  if(options.token != undefined) {
    headers['AUTHORIZATION'] = options.token;
  }

  if(options.proxyUser != undefined){
    headers['PROXY-USER'] = options.proxyUser;
  }

  if (params != undefined){
    payload = JSON.stringify(params);
    headers["content-length"] = payload.length;
  }

  options = {
    host: host,
    port: port,
    path: path,
    method: method,
    headers: headers
  };
  var protocol = isSecure ? https : http;

  var req = protocol.request(options, function (res) {
    res.setEncoding('utf8');
    var data = '';
    res.on('data', function(chunk) {
      data += chunk;
    });

    res.on('end', function() {
      // TODO - improve error handling here..
      var error = {
        host: host,
        method: method,
        status: res.statusCode,
        message: data,
        path: path,
        params: params,
        headers: headers
      };
      if(res.statusCode < 200 || res.statusCode >= 400) return callback(error);
      data = data.trim();
      data = data === '' ? {} : JSON.parse(data);
      return callback(undefined, data);
    });
  });

  req.on('error', function(e) {
    return callback(e);
  });

  if (params != undefined){
    req.write(payload);
  }

  req.end();
};

// Uploads zipfile to CF
function upload(host, port, isSecure, options, file, path, resources, callback) {

  var boundary = Math.random();
  var post_data = [];

  post_data.push(new Buffer(encodeFieldPart(boundary, 'resources', resources), 'ascii'));
  post_data.push(new Buffer(encodeFieldPart(boundary, '_method', 'put'), 'ascii'));
  post_data.push(new Buffer(encodeFilePart(boundary, 'application/zip', 'application', file)));

  var file_reader = fs.createReadStream(file, {encoding: 'binary'});
  var file_contents = '';
  file_reader.on('data', function(data){
    file_contents += data;
  });
  file_reader.on('end', function(){
    post_data.push(new Buffer(file_contents, 'binary'));
    post_data.push(new Buffer("\r\n--" + boundary + "--"), 'ascii');
    doUpload(host, port, isSecure, options, path, post_data, boundary, callback);
  });
};

function encodeFieldPart(boundary, name, value) {
    var return_part = "--" + boundary + "\r\n";
    return_part += "Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n";
    return_part += value + "\r\n";
    return return_part;
}

function encodeFilePart(boundary, type, name, filename) {
    var return_part = "--" + boundary + "\r\n";
    return_part += "Content-Disposition: form-data; name=\"" + name + "\"; filename=\"" + filename + "\"\r\n";
    return_part += "Content-Type: " + type + "\r\n\r\n";
    return return_part;
}

function doUpload(host, port, isSecure, options, path, post_data, boundary, callback) {
  var length = 0;

  for(var i = 0; i < post_data.length; i++) {
    length += post_data[i].length;
  }

  var headers = {
    'Content-Type' : 'multipart/form-data; boundary=' + boundary,
    'Content-Length' : length,
    'Accept-Encoding' : 'gzip, deflate',
    'Accept' : '*/*; q=0.5, application/xml'
  };

  if(options.token != undefined) {
    headers['AUTHORIZATION'] = options.token;
  }

  if(options.proxyUser != undefined){
    headers['PROXY-USER'] = options.proxyUser;
  }

  options = {
    host: host,
    port: port,
    path: path,
    method: 'POST',
    headers: headers
  };

  var protocol = isSecure ? https : http;
  var req = protocol.request(options, function(res){
    // TODO - not sure what POST /apps/<app>/application returns here exactly (some binary..)
    // but seems safe to ignore if the call is successful..
    res.setEncoding('utf8');
    var data = '';
    res.on('data', function(chunk){
      data = data + chunk;
    });

    res.on('end', function(){
      return callback();
    });

    res.on('error', function(err) {
      return callback(err, data);
    });
  });

  for (var i = 0; i < post_data.length; i++) {
    req.write(post_data[i]);
  }
  req.end();
}

exports.upload = upload;
exports.request = request;