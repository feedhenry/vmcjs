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

See the tests for more sample API usage.

## Running tests

You need to set your own CloudFoundry account credentials before running the tests. First, set the following three environment variables:

    export CF_TARGET=<CloudFoundry target> e.g. for a local micro instance http://api.<name>.cloudfoundry.me
    export CF_EMAIL=<CloudFoundry user email> e.g. foo@bar.com
    export CF_PWD=<CloudFoundry user password>
    export CF_ADMIN_EMAIL=<CloudFoundry administrator email> e.g. foo@vmware.com
    export CF_ADMIN_PWD=<CloudFoundry administrator password>

Then run the tests with:
    expresso -I lib
