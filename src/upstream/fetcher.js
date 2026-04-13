'use strict';

const got = require('got');
const { getLogger } = require('../logger');

/**
 * Fetch a tile (or any binary resource) from an upstream URL.
 * Returns { buffer, contentType, statusCode }.
 * Throws on network or HTTP error.
 */
async function fetchTile(upstreamUrl, extraHeaders = {}) {
  const log = getLogger();
  log.debug({ upstreamUrl }, 'fetching from upstream');

  const response = await got(upstreamUrl, {
    responseType: 'buffer',
    timeout: { request: 15000 },
    retry: { limit: 2, methods: ['GET'], statusCodes: [429, 500, 502, 503, 504] },
    headers: {
      'Accept': 'image/png,image/jpeg,image/gif,image/webp,application/x-protobuf,*/*',
      ...extraHeaders,
    },
    throwHttpErrors: true,
  });

  return {
    buffer: response.body,
    contentType: response.headers['content-type'] ?? 'application/octet-stream',
    statusCode: response.statusCode,
  };
}

/**
 * Fetch a GetCapabilities XML document.
 * Returns the response body as a string.
 */
async function fetchCapabilities(upstreamUrl, extraHeaders = {}) {
  const response = await got(upstreamUrl, {
    responseType: 'text',
    timeout: { request: 15000 },
    retry: { limit: 1 },
    headers: {
      'Accept': 'application/xml,text/xml,*/*',
      ...extraHeaders,
    },
    throwHttpErrors: true,
  });

  return {
    body: response.body,
    contentType: response.headers['content-type'] ?? 'application/xml',
  };
}

module.exports = { fetchTile, fetchCapabilities };
