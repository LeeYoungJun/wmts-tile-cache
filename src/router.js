'use strict';

const express = require('express');
const { getTileHandler } = require('./handlers/getTile');
const { getCapabilitiesHandler } = require('./handlers/getCapabilities');
const { statsHandler } = require('./handlers/stats');

const router = express.Router();

// ---------------------------------------------------------------------------
// Stats & health
// ---------------------------------------------------------------------------
router.get('/_stats', statsHandler);
router.get('/_health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ---------------------------------------------------------------------------
// GetCapabilities
//   GET /wmts/:service/WMTSCapabilities.xml
//   GET /wmts/:service?SERVICE=WMTS&REQUEST=GetCapabilities
// ---------------------------------------------------------------------------
router.get('/:service/WMTSCapabilities.xml', getCapabilitiesHandler);

router.get('/:service', (req, res, next) => {
  const { REQUEST, request } = req.query;
  const reqType = (REQUEST ?? request ?? '').toUpperCase();

  if (reqType === 'GETCAPABILITIES') return getCapabilitiesHandler(req, res);
  if (reqType === 'GETTILE')         return getTileHandler(req, res);

  next(); // fall through to 404
});

// ---------------------------------------------------------------------------
// GetTile — REST path styles
//
// Full WMTS REST:
//   GET /wmts/:service/:layer/:style/:tms/:z/:y/:x.:ext
//
// Short (TMS-style, no layer/style/tms):
//   GET /wmts/:service/:z/:y/:x.:ext
// ---------------------------------------------------------------------------

// Full WMTS REST
router.get('/:service/:layer/:style/:tms/:z/:y/:x.:ext', getTileHandler);

// No-layer shorthand (useful for plain TMS services configured with tms style)
router.get('/:service/:z/:y/:x.:ext', (req, res) => {
  // Inject dummy layer/style/tms so getTileHandler doesn't need special-casing
  req.params.layer = undefined;
  req.params.style = undefined;
  req.params.tms   = undefined;
  getTileHandler(req, res);
});

module.exports = router;
