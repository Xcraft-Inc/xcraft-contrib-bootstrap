'use strict';

var path  = require ('path');
var async = require ('async');

var xPlatform = require ('xcraft-core-platform');

var cmd = {};

/**
 * Bootstrap WPKG.
 *
 * 1. Build and install CMake.
 * 2. Build and install WPKG.
 */
cmd.wpkg = function (msg, response) {
  async.auto ({
    cmake: function (callback) {
      response.command.send ('cmake.build', null, callback);
    },

    wpkg: ['cmake', function (callback) {
      response.command.send ('wpkg.build', null, callback);
    }]
  }, function (err) {
    if (err) {
      response.log.err (err);
    } else {
      response.log.info ('wpkg bootstrapped');
    }

    response.events.send ('bootstrap.wpkg.finished');
  });
};

/**
 * Bootstrap the peon.
 */
cmd.peon = function (msg, response) {
  var boot = 'bootstrap+' + xPlatform.getOs ();

  var errCallback = function (err, msg, callback) {
    if (!err && msg.data === response.events.status.failed) {
      err = 'the command has failed';
    }
    callback (err);
  };

  async.auto ({
    /* Make bootstrap packages and all deps. */
    make: function (callback) {
      var msg = {
        packageArgs: [boot + ',<-deps']
      };

      response.command.send ('pacman.make', msg, function (err, msg) {
        errCallback (err, msg, callback);
      });
    },

    /* Build bootstrap packages. */
    build: ['make', function (callback) {
      const msg = {
        packageRefs: boot
      };

      response.command.send ('pacman.build', msg, function (err, msg) {
        errCallback (err, msg, callback);
      });
    }],

    /* Install bootstrap package. */
    install: ['build', function (callback) {
      var msg = {
        packageRefs: boot
      };

      response.command.send ('pacman.install', msg, function (err, msg) {
        errCallback (err, msg, callback);
      });
    }]
  }, function (err) {
    if (err) {
      response.log.err (err);
    } else {
      response.log.info ('peon bootstrapped');
    }

    response.events.send ('bootstrap.peon.finished');
  });
};

/**
 * Bootstrap everything.
 *
 * 1. Bootstrap WPKG.
 * 2. Bootstrap the peon.
 */
cmd.all = function (msg, response) {
  async.series ([
    function (callback) {
      response.command.send ('bootstrap.wpkg', null, callback);
    },

    function (callback) {
      response.command.send ('bootstrap.peon', null, callback);
    }
  ], function (err) {
    if (err) {
      response.log.err (err);
    } else {
      response.log.info ('everything bootstrapped');
    }

    response.events.send ('bootstrap.all.finished');
  });
};

/**
 * Retrieve the list of available commands.
 *
 * @returns {Object} The list and definitions of commands.
 */
exports.xcraftCommands = function () {
  const xUtils = require ('xcraft-core-utils');
  return {
    handlers: cmd,
    rc: xUtils.json.fromFile (path.join (__dirname, './rc.json'))
  };
};
