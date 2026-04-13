'use strict';

const pino = require('pino');

let _logger = null;

function createLogger(level = 'info') {
  if (_logger) return _logger;

  const isDev = process.env.NODE_ENV !== 'production';

  _logger = pino({
    level,
    transport: isDev
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
  });

  return _logger;
}

function getLogger() {
  return _logger ?? createLogger();
}

module.exports = { createLogger, getLogger };
