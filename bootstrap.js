'use strict';

var path = require('path');

var xPlatform = require('xcraft-core-platform');

var cmd = {};

/**
 * Bootstrap WPKG.
 *
 * 1. Build and install CMake.
 * 2. Build and install WPKG.
 */
cmd.wpkg = function*(msg, resp, next) {
  try {
    yield resp.command.send('cmake.build', null, next);
    yield resp.command.send('wpkg.build', null, next);

    resp.log.info('wpkg bootstrapped');
  } catch (ex) {
    resp.log.err(ex.stack || ex);
  } finally {
    resp.events.send(`bootstrap.wpkg.${msg.id}.finished`);
  }
};

/**
 * Bootstrap the peon.
 */
cmd.peon = function*(msg, resp, next) {
  const boot = 'bootstrap+' + xPlatform.getOs();

  let cmdMsg = null;
  let result = null;

  try {
    /* Make bootstrap packages and all deps. */
    cmdMsg = {
      packageArgs: [boot + ',@deps'],
    };

    result = yield resp.command.send('pacman.make', cmdMsg, next);
    if (result.data === resp.events.status.failed) {
      throw 'the command has failed';
    }

    cmdMsg = {
      packageRefs: boot,
    };

    /* Build bootstrap packages. */
    result = yield resp.command.send('pacman.build', cmdMsg, next);
    if (result.data === resp.events.status.failed) {
      throw 'the command has failed';
    }

    /* Install bootstrap package. */
    result = yield resp.command.send('pacman.install', cmdMsg, next);
    if (result.data === resp.events.status.failed) {
      throw 'the command has failed';
    }

    resp.log.info('peon bootstrapped');
  } catch (ex) {
    resp.log.err(ex.stack || ex);
  } finally {
    resp.events.send(`bootstrap.peon.${msg.id}.finished`);
  }
};

/**
 * Bootstrap everything.
 *
 * 1. Bootstrap WPKG.
 * 2. Bootstrap the peon.
 */
cmd.all = function*(msg, resp, next) {
  try {
    yield resp.command.send('bootstrap.wpkg', null, next);
    yield resp.command.send('bootstrap.peon', null, next);

    resp.log.info('everything bootstrapped');
  } catch (ex) {
    resp.log.err(ex.stack || ex);
  } finally {
    resp.events.send(`bootstrap.all.${msg.id}.finished`);
  }
};

/**
 * Retrieve the list of available commands.
 *
 * @returns {Object} The list and definitions of commands.
 */
exports.xcraftCommands = function() {
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
