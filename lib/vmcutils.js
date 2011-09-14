var spawn = require('child_process').spawn;

exports.vendorService = function(services, vendor) {
  var vendorService;
  for (var serviceType in services) {
    var service = services[serviceType];
    for (var product in service) {
      var productService = service[product];
      for (var versionedProduct in productService) {
        var prod = productService[versionedProduct];
        if (prod.vendor == vendor) {
          vendorService = prod;
          break;
        }              
      }
    }
  } 
  return vendorService;  
};

// reference client.rb create_service in VMC gem
exports.serviceHash = function(service, name) {
  var serviceHash = {
    type: service.type, 
    version: service.version,
    tier: 'free',
    vendor: service.vendor,
    version: service.version,
    name: name
  };
  return serviceHash;
};

exports.zip = function(dir, zipFile, callback) {
  var excludes = "\\.. \\. \\*~ \\#*# \\*.log";
  // TODO - exclude git files..
  var zip = spawn('zip', ['-y', '-q', '-r', zipFile, '.', '-x', excludes], {cwd: dir});

  zip.on('exit', function(code){
    if (code != 0) return callback(new Error('Error during zip!'));
    return callback(undefined, code);
  });
};
