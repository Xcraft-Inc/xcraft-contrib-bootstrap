'use strict';

var moduleName = 'bootstrap';

var path  = require ('path');
var async = require ('async');

var xLog      = require ('xcraft-core-log') (moduleName);
var xPlatform = require ('xcraft-core-platform');
var busClient = require ('xcraft-core-busclient').getGlobal ();

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
 */
cmd.peon = function () {
  var boot = 'bootstrap+' + xPlatform.getOs ();

  async.auto ({
    /* Make bootstrap packages and all deps. */
    make: function (callback) {
      var msg = {
        packageArgs: [boot + ',<-deps']
      };

      busClient.command.send ('pacman.make', msg, callback);
    },

    /* Build bootstrap packages. */
    build: ['make', function (callback) {
      busClient.command.send ('pacman.build', {}, callback);
    }],

    /* Install bootstrap package. */
    install: ['build', function (callback) {
      var msg = {
        packageRefs: boot
      };

      busClient.command.send ('pacman.install', msg, callback);
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
