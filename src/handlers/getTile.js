'use strict';

const path = require('path');
const pLimit = require('p-limit').default;
const { getService, loadConfig } = require('../config');
const { tileCachePath } = require('../cache/cacheKey');
const { readTile, writeTile } = require('../cache/fileCache');
const { buildTileUrl } = require('../upstream/urlBuilder');
const { fetchTile } = require('../upstream/fetcher');
const { recordHit, recordMiss, recordError } = require('../stats');
const { getLogger } = require('../logger');

// upstream 동시 요청 최대 10개로 제한 (OSM rate limit 방지)
const upstreamLimit = pLimit(10);

// 진행 중인 upstream fetch를 캐시 경로 기준으로 추적 (thundering herd 방지)
const _inflight = new Map();

/**
 * Parse tile parameters from a request.
 * Supports both REST path params and KVP query params.
 */
function parseParams(req) {
  const p = req.params;
  const q = req.query;

  // REST style: params come from the route pattern
  if (p.service) {
    return {
      service:       p.service,
      layer:         p.layer   ?? q.LAYER   ?? q.layer,
      style:         p.style   ?? q.STYLE   ?? q.style   ?? 'default',
      tilematrixset: p.tms     ?? q.TILEMATRIXSET ?? q.tilematrixset,
      z:             p.z       ?? q.TILEMATRIX ?? q.z,
      y:             p.y       ?? q.TILEROW   ?? q.y,
      x:             p.x       ?? q.TILECOL   ?? q.x,
      ext:           p.ext     ?? guessExt(q.FORMAT),
    };
  }

  // KVP style: everything from query string
  return {
    service:       p.service ?? q.service,
    layer:         q.LAYER   ?? q.layer,
    style:         q.STYLE   ?? q.style   ?? 'default',
    tilematrixset: q.TILEMATRIXSET ?? q.tilematrixset,
    z:             q.TILEMATRIX ?? q.z,
    y:             q.TILEROW    ?? q.y,
    x:             q.TILECOL    ?? q.x,
    ext:           guessExt(q.FORMAT ?? q.format),
  };
}

function guessExt(mimeOrExt) {
  if (!mimeOrExt) return 'png';
  const map = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'application/x-protobuf': 'pbf',
    'application/vnd.mapbox-vector-tile': 'mvt',
  };
  return map[mimeOrExt] ?? mimeOrExt.split('/').pop().split(';')[0] ?? 'png';
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
async function getTileHandler(req, res) {
  const log = getLogger();
  const start = Date.now();
  const params = parseParams(req);

  const { service: serviceName } = params;
  if (!serviceName) {
    return res.status(400).json({ error: 'Missing service name' });
  }

  const serviceCfg = getService(serviceName);
  if (!serviceCfg) {
    return res.status(404).json({ error: `Unknown service: ${serviceName}` });
  }

  // Layer allowlist check
  const allowlist = serviceCfg.layers?.allowlist;
  if (allowlist?.length && params.layer && !allowlist.includes(params.layer)) {
    return res.status(403).json({ error: `Layer not allowed: ${params.layer}` });
  }

  const filePath = tileCachePath(params);
  const cfg = loadConfig();

  try {
    // -----------------------------------------------------------------------
    // Cache HIT
    // -----------------------------------------------------------------------
    const cached = await readTile(filePath);
    if (cached) {
      recordHit(serviceName);
      const maxAge = (serviceCfg.cache?.maxAgeDays ?? cfg.cache.maxAgeDays ?? 30) * 86400;
      res.set({
        'Content-Type': cached.contentType,
        'Cache-Control': `public, max-age=${maxAge}`,
        'X-Cache': 'HIT',
        'Last-Modified': cached.mtime.toUTCString(),
      });
      log.debug({ serviceName, z: params.z, y: params.y, x: params.x, ms: Date.now() - start }, 'cache HIT');
      return res.send(cached.buffer);
    }

    // -----------------------------------------------------------------------
    // Cache MISS — fetch from upstream (deduplication + concurrency limit)
    // -----------------------------------------------------------------------
    recordMiss(serviceName);
    const upstreamUrl = buildTileUrl(serviceCfg, params);
    log.debug({ serviceName, upstreamUrl }, 'cache MISS — fetching upstream');

    // 동일 타일에 대한 중복 upstream 요청을 하나로 합침 (thundering herd 방지)
    let inflightPromise = _inflight.get(filePath);
    if (!inflightPromise) {
      inflightPromise = upstreamLimit(() => fetchTile(upstreamUrl, serviceCfg.headers ?? {}))
        .finally(() => _inflight.delete(filePath));
      _inflight.set(filePath, inflightPromise);
    }

    const { buffer, contentType } = await inflightPromise;

    // Write to cache (non-blocking — don't await, don't let it delay response)
    writeTile(filePath, buffer);

    const maxAge = (serviceCfg.cache?.maxAgeDays ?? cfg.cache.maxAgeDays ?? 30) * 86400;
    res.set({
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${maxAge}`,
      'X-Cache': 'MISS',
    });
    log.info({ serviceName, z: params.z, y: params.y, x: params.x, ms: Date.now() - start }, 'tile fetched');
    return res.send(buffer);

  } catch (err) {
    recordError(serviceName);
    log.error({ err, serviceName, params }, 'tile fetch error');

    if (err.response) {
      return res.status(502).json({
        error: 'Upstream error',
        upstreamStatus: err.response.statusCode,
      });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getTileHandler };
