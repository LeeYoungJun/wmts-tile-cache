'use strict';

const path = require('path');
const { loadConfig } = require('../config');
const { countCachedTiles } = require('../cache/fileCache');
const { getCounters, getUptimeSeconds } = require('../stats');

async function statsHandler(req, res) {
  const cfg = loadConfig();
  const counters = getCounters();

  // Build per-service stats (with async tile count)
  const serviceStats = await Promise.all(
    cfg.services.map(async (svc) => {
      const ctr = counters[svc.name] ?? { hits: 0, misses: 0, errors: 0 };
      const total = ctr.hits + ctr.misses;
      const cacheDir = path.join(cfg.cache.directory, svc.name);
      const cachedTiles = await countCachedTiles(cacheDir);

      return [svc.name, {
        label: svc.label ?? svc.name,
        hits: ctr.hits,
        misses: ctr.misses,
        errors: ctr.errors,
        hitRatio: total > 0 ? Math.round((ctr.hits / total) * 1000) / 1000 : null,
        cachedTiles,
        cacheDir,
      }];
    })
  );

  const allCounters = Object.values(counters);
  const total = {
    hits:   allCounters.reduce((s, c) => s + c.hits,   0),
    misses: allCounters.reduce((s, c) => s + c.misses, 0),
    errors: allCounters.reduce((s, c) => s + c.errors, 0),
  };

  res.json({
    uptime: getUptimeSeconds(),
    cacheDirectory: cfg.cache.directory,
    services: Object.fromEntries(serviceStats),
    total,
  });
}

module.exports = { statsHandler };
