'use strict';

var moduleName = 'bootstrap';

var path  = require ('path');
var async = require ('async');

var xLog      = require ('xcraft-core-log') (moduleName);
var xPlatform = require ('xcraft-core-platform');
var busClient = require ('xcraft-core-busclient');

var cmd = {};

/**
 * Bootstrap WPKG.
 *
 * 1. Build and install CMake.
 * 2. Build and install WPKG.
 */
cmd.wpkg = function () {
  async.auto ({
    cmake: function (callback) {
      busClient.command.send ('cmake.build', null, callback);
    },

    wpkg: ['cmake', function (callback) {
      busClient.command.send ('wpkg.build', null, callback);
    }]
  }, function (err) {
    if (err) {
      xLog.err (err);
    } else {
      xLog.info ('wpkg bootstrapped');
    }

    busClient.events.send ('bootstrap.wpkg.finished');
  });
};

/**
 * Bootstrap the peon.
 *
 * 1. List all packages in the bootstrap namespace.
 * 2. Make these packages.
 *    Deploy in the local repositories (src too).
 * 3. Install these packages in the devroot/.
 * 4. Build the installed source packages in devroot/.
 *    Deploy these packages in the local repository.
 * 5. Install the built packages in devroot/.
 */
cmd.peon = function () {
  async.auto ({
    /* Retrieve the list of bootstrap packages. */
    list: function (callback) {
      var list = [];

      busClient.events.subscribe ('pacman.list', function (msg) {
        busClient.events.unsubscribe ('pacman.list');
        msg.data.forEach (function (item) {
          if (/^bootstrap\+/.test (item.name)) {
            list.push ({
              name:  item.name,
              build: item.architecture.indexOf ('source') !== -1
            });
          }
        });
      });

      busClient.command.send ('pacman.list', null, function () {
        callback (null, list);
      });
    },

    /* Make bootstrap packages. */
    make: ['list', function (callback, results) {
      var list = [];

      async.eachSeries (results.list, function (item, callback) {
        busClient.events.subscribe ('pacman.make.control', function (msg) {
          busClient.events.unsubscribe ('pacman.make.control');

          if (!msg.data) {
            return;
          }

          msg.data.some (function (controlFile) {
            if (controlFile.arch !== 'all' &&
                controlFile.arch !== 'source' &&
                controlFile.arch !== xPlatform.getToolchainArch ()) {
              return false;
            }

            list.push ({
              name:  item.name,
              build: controlFile.arch === 'source'
            });

            return true;
          });
        });

        var msg = {
          packageName: item.name
        };
        busClient.command.send ('pacman.make', msg, callback);
      }, function (err) {
        callback (err, list);
      });
    }],

    /* Install bootstrap packages (and source packages). */
    install: ['make', function (callback, results) {
      var list = [];

      async.eachSeries (results.make, function (item, callback) {
        if (item.build) {
          list.push (item.name);
          callback ();
          return;
        }

        var msg = {
          packageRef: item.name
        };
        busClient.command.send ('pacman.install', msg, callback);
      }, function (err) {
        callback (err, list);
      });
    }],

    /* Build bootstrap packages. */
    build: ['install', function (callback) {
      var msg = {
        packageRef: ''
      };
      busClient.command.send ('pacman.build', msg, callback);
    }],

    /* Install builded packages. */
    installBuild: ['build', function (callback, results) {
      async.eachSeries (results.install, function (item, callback) {
        var msg = {
          packageRef: item
        };
        busClient.command.send ('pacman.install', msg, callback);
      }, callback);
    }]
  }, function (err) {
    if (err) {
      xLog.err (err);
    } else {
      xLog.info ('peon bootstrapped');
    }

    busClient.events.send ('bootstrap.peon.finished');
  });
};

/**
 * Bootstrap everything.
 *
 * 1. Bootstrap WPKG.
 * 2. Bootstrap the peon.
 */
cmd.all = function () {
  async.series ([
    function (callback) {
      busClient.command.send ('bootstrap.wpkg', null, callback);
    },

    function (callback) {
      busClient.command.send ('bootstrap.peon', null, callback);
    }
  ], function (err) {
    if (err) {
      xLog.err (err);
    } else {
      xLog.info ('everything bootstrapped');
    }

    busClient.events.send ('bootstrap.all.finished');
  });
};

/**
 * Retrieve the list of available commands.
 *
 * @returns {Object} The list and definitions of commands.
 */
exports.xcraftCommands = function () {
  return {
    handlers: cmd,
    rc: path.join (__dirname, './rc.json')
  };
};

/**
 * Publish commands for std module exports.
 */
var main = function () {
  Object.keys (cmd).forEach (function (action) {
    exports[action] = cmd[action];
  });
};

main ();
