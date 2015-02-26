'use strict';

var moduleName = 'bootstrap';

var path  = require ('path');
var async = require ('async');

var xLog      = require ('xcraft-core-log') (moduleName);
var xPlatform = require ('xcraft-core-platform');
var busClient = require ('xcraft-core-busclient');

var cmd = {};

cmd.wpkg = function () {
  async.auto ({
    cmake: function (callback) {
      busClient.events.subscribe ('cmake.build.finished', function () {
        busClient.events.unsubscribe ('cmake.build.finished');
        callback ();
      });

      busClient.command.send ('cmake.build');
    },

    wpkg: ['cmake', function (callback) {
      busClient.events.subscribe ('wpkg.build.finished', function () {
        busClient.events.unsubscribe ('wpkg.build.finished');
        callback ();
      });

      busClient.command.send ('wpkg.build');
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

      busClient.events.subscribe ('pacman.list.finished', function () {
        busClient.events.unsubscribe ('pacman.list.finished');
        callback (null, list);
      });

      busClient.command.send ('pacman.list');
    },

    /* Make bootstrap packages. */
    make: ['list', function (callback, results) {
      var list = [];

      async.eachSeries (results.list, function (item, callback) {
        busClient.events.subscribe ('pacman.make.control', function (msg) {
          busClient.events.unsubscribe ('pacman.make.control');

          msg.data.forEach (function (controlFile) {
            list.push ({
              name:  item.name,
              build: controlFile.arch === 'source'
            });
          });
        });

        busClient.events.subscribe ('pacman.make.finished', function () {
          busClient.events.unsubscribe ('pacman.make.finished');
          callback ();
        });

        var msg = {
          packageName: item.name
        };
        busClient.command.send ('pacman.make', msg);
      }, function (err) {
        callback (err, list);
      });
    }],

    /* Install bootstrap packages (and source packages). */
    install: ['make', function (callback, results) {
      var list = [];

      async.eachSeries (results.make, function (item, callback) {
        busClient.events.subscribe ('pacman.install.finished', function () {
          busClient.events.unsubscribe ('pacman.install.finished');
          callback ();
        });

        if (item.build) {
          list.push (item.name);
        }

        var msg = {
          packageRef: item.name + (item.build ? '-src' : '') + ':' + xPlatform.getToolchainArch ()
        };
        busClient.command.send ('pacman.install', msg);
      }, function (err) {
        callback (err, list);
      });
    }],

    /* Build bootstrap packages. */
    build: ['install', function (callback, results) {
      async.eachSeries (results.install, function (item, callback) {
        if (!item.build) {
          callback ();
          return;
        }

        busClient.events.subscribe ('pacman.build.finished', function () {
          busClient.events.unsubscribe ('pacman.build.finished');
          callback ();
        });

        var msg = {
          packageRef: item.name + ':' + xPlatform.getToolchainArch ()
        };
        busClient.command.send ('pacman.build', msg);
      }, callback);
    }],

    /* Install builded packages. */
    installBuild: ['build', function (callback, results) {
      async.eachSeries (results.install, function (item, callback) {
        busClient.events.subscribe ('pacman.install.finished', function () {
          busClient.events.unsubscribe ('pacman.install.finished');
          callback ();
        });

        var msg = {
          packageRef: item.name + ':' + xPlatform.getToolchainArch ()
        };
        busClient.command.send ('pacman.install', msg);
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

cmd.all = function () {
  async.series ([
    function (callback) {
      busClient.events.subscribe ('bootstrap.wpkg.finished', function () {
        busClient.events.unsubscribe ('bootstrap.wpkg.finished');
        callback ();
      });

      busClient.command.send ('bootstrap.wpkg');
    },

    function (callback) {
      busClient.events.subscribe ('bootstrap.peon.finished', function () {
        busClient.events.unsubscribe ('bootstrap.peon.finished');
        callback ();
      });

      busClient.command.send ('bootstrap.peon');
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
