'use strict';

var path = require ('path');

var xPlatform = require ('xcraft-core-platform');

var cmd = {};

/**
 * Bootstrap WPKG.
 *
 * 1. Build and install CMake.
 * 2. Build and install WPKG.
 */
cmd.wpkg = function* (msg, response, next) {
  try {
    yield response.command.send ('cmake.build', null, next);
    yield response.command.send ('wpkg.build', null, next);

    response.log.info ('wpkg bootstrapped');
  } catch (ex) {
    response.log.err (ex.stack || ex);
  } finally {
    response.events.send (`bootstrap.wpkg.${msg.id}.finished`);
  }
};

/**
 * Bootstrap the peon.
 */
cmd.peon = function* (msg, response, next) {
  const boot = 'bootstrap+' + xPlatform.getOs ();

  let cmdMsg = null;
  let result = null;

  try {
    /* Make bootstrap packages and all deps. */
    cmdMsg = {
      packageArgs: [boot + ',@deps'],
    };

    result = yield response.command.send ('pacman.make', cmdMsg, next);
    if (result.data === response.events.status.failed) {
      throw 'the command has failed';
    }

    cmdMsg = {
      packageRefs: boot,
    };

    /* Build bootstrap packages. */
    result = yield response.command.send ('pacman.build', cmdMsg, next);
    if (result.data === response.events.status.failed) {
      throw 'the command has failed';
    }

    /* Install bootstrap package. */
    result = yield response.command.send ('pacman.install', cmdMsg, next);
    if (result.data === response.events.status.failed) {
      throw 'the command has failed';
    }

    response.log.info ('peon bootstrapped');
  } catch (ex) {
    response.log.err (ex.stack || ex);
  } finally {
    response.events.send (`bootstrap.peon.${msg.id}.finished`);
  }
};

/**
 * Bootstrap everything.
 *
 * 1. Bootstrap WPKG.
 * 2. Bootstrap the peon.
 */
cmd.all = function* (msg, response, next) {
  try {
    yield response.command.send ('bootstrap.wpkg', null, next);
    yield response.command.send ('bootstrap.peon', null, next);

    response.log.info ('everything bootstrapped');
  } catch (ex) {
    response.log.err (ex.stack || ex);
  } finally {
    response.events.send (`bootstrap.all.${msg.id}.finished`);
  }
};

/**
 * Retrieve the list of available commands.
 *
 * @returns {Object} The list and definitions of commands.
 */
exports.xcraftCommands = function () {
  return {
    handlers: cmd,
    rc: {
      wpkg: {
        desc: 'bootstrap the package manager',
      },
      peon: {
        desc: 'bootstrap for devroot/',
      },
      all: {
        desc: 'bootstrap everything',
      },
    },
  };
};
