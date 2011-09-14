# vmcjs

A node.js library version of the CloudFoundry VMC gem.

_Copyright 2011, FeedHenry Ltd. Licensed under the
MIT license, please see the LICENSE file.  All rights reserved._

## Installation
    npm install vmcjs

## Example usage

    var vmcjs = require('vmcjs');
    var vmc = new vmcjs.VMC(target, user, pwd);
    vmc.login(function(err) {
      vmc.apps(function(err, apps){
        console.dir(apps)
      });
    });
