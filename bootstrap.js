'use strict';

var cmd = {};

/**
 * Bootstrap WPKG.
 *
 * 1. Build and install CMake.
 * 2. Build and install WPKG.
 */
cmd.wpkg = function* (msg, resp, next) {
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
    },
  };
};
