'use strict';

/**
 * In-memory request counters.
 * Reset on server restart — good enough for operational monitoring.
 */

const _startTime = Date.now();

// { [serviceName]: { hits: 0, misses: 0, errors: 0 } }
const _counters = {};

function _ensure(service) {
  if (!_counters[service]) {
    _counters[service] = { hits: 0, misses: 0, errors: 0 };
  }
}

function recordHit(service)   { _ensure(service); _counters[service].hits++;   }
function recordMiss(service)  { _ensure(service); _counters[service].misses++;  }
function recordError(service) { _ensure(service); _counters[service].errors++; }

function getCounters() {
  return JSON.parse(JSON.stringify(_counters));
}

function getUptimeSeconds() {
  return Math.floor((Date.now() - _startTime) / 1000);
}

module.exports = { recordHit, recordMiss, recordError, getCounters, getUptimeSeconds };
