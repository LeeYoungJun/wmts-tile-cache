'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { loadConfig } = require('./config');
const { createLogger } = require('./logger');
const router = require('./router');

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
let cfg;
try {
  cfg = loadConfig();
} catch (err) {
  console.error('[wmts-tile-cache] Fatal: could not load config\n', err.message);
  process.exit(1);
}

const log = createLogger(cfg.server.logLevel);

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors({ origin: cfg.server.corsOrigins }));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  log.debug({ method: req.method, url: req.url }, 'incoming request');
  next();
});

// ---------------------------------------------------------------------------
// Routes — all WMTS endpoints live under /wmts
// ---------------------------------------------------------------------------
app.use('/wmts', router);

// Root redirect to stats
app.get('/', (_req, res) => res.redirect('/wmts/_stats'));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const port = process.env.PORT ?? cfg.server.port ?? 3000;
app.listen(port, () => {
  log.info({ port, services: cfg.services.map(s => s.name) }, 'wmts-tile-cache started');
  log.info(`Stats:  http://localhost:${port}/wmts/_stats`);
  log.info(`Health: http://localhost:${port}/wmts/_health`);

  cfg.services.forEach(svc => {
    log.info(`[${svc.name}] http://localhost:${port}/wmts/${svc.name}/...`);
  });
});

module.exports = app;
