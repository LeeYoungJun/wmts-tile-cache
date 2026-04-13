'use strict';

const { getService } = require('../config');
const { buildCapabilitiesUrl } = require('../upstream/urlBuilder');
const { fetchCapabilities } = require('../upstream/fetcher');
const { getLogger } = require('../logger');

// Simple in-memory TTL cache for GetCapabilities responses
// { [serviceName]: { body, contentType, expiresAt } }
const _capCache = {};

async function getCapabilitiesHandler(req, res) {
  const log = getLogger();
  const { service: serviceName } = req.params;

  if (!serviceName) {
    return res.status(400).json({ error: 'Missing service name' });
  }

  const serviceCfg = getService(serviceName);
  if (!serviceCfg) {
    return res.status(404).json({ error: `Unknown service: ${serviceName}` });
  }

  // In-memory TTL check
  const cached = _capCache[serviceName];
  if (cached && cached.expiresAt > Date.now()) {
    res.set({ 'Content-Type': cached.contentType, 'X-Cache': 'HIT' });
    return res.send(cached.body);
  }

  try {
    const upstreamUrl = buildCapabilitiesUrl(serviceCfg);
    log.debug({ serviceName, upstreamUrl }, 'fetching GetCapabilities');

    const { body, contentType } = await fetchCapabilities(upstreamUrl, serviceCfg.headers ?? {});

    // Get TTL from config (default 300s)
    const { loadConfig } = require('../config');
    const ttlMs = (loadConfig().cache.capabilitiesTtlSeconds ?? 300) * 1000;

    _capCache[serviceName] = { body, contentType, expiresAt: Date.now() + ttlMs };

    res.set({ 'Content-Type': contentType, 'X-Cache': 'MISS' });
    return res.send(body);
  } catch (err) {
    log.error({ err, serviceName }, 'GetCapabilities error');
    if (err.response) {
      return res.status(502).json({ error: 'Upstream error', upstreamStatus: err.response.statusCode });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getCapabilitiesHandler };
