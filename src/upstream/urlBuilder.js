'use strict';

/**
 * Build the upstream URL for a tile request based on service config.
 *
 * Supports three styles:
 *   rest  – path template like "/{layer}/{style}/{tilematrixset}/{z}/{y}/{x}.{ext}"
 *   kvp   – query-string style: ?SERVICE=WMTS&REQUEST=GetTile&...
 *   tms   – simple TMS: /{z}/{x}/{y}.{ext}
 */
function buildTileUrl(serviceCfg, params) {
  const { url, style, restTemplate, kvpDefaults = {}, extraParams = {} } = serviceCfg.upstream;
  const { layer, style: tileStyle, tilematrixset, z, y, x, ext } = params;

  if (style === 'tms') {
    // Pure TMS — ignores layer/style/tms fields
    const tmpl = restTemplate ?? '/{z}/{x}/{y}.{ext}';
    const tmsPath = tmpl
      .replace('{z}', z)
      .replace('{x}', x)
      .replace('{y}', y)
      .replace('{ext}', ext ?? 'png');
    return url.replace(/\/$/, '') + tmsPath;
  }

  if (style === 'rest') {
    const tmpl = restTemplate ?? '/{layer}/{style}/{tilematrixset}/{z}/{y}/{x}.{ext}';

    // Build extra param replacements (e.g. apiKey)
    let urlPart = tmpl
      .replace('{layer}', encodeURIComponent(layer ?? ''))
      .replace('{style}', encodeURIComponent(tileStyle ?? 'default'))
      .replace('{tilematrixset}', encodeURIComponent(tilematrixset ?? ''))
      .replace('{z}', z)
      .replace('{y}', y)
      .replace('{x}', x)
      .replace('{ext}', ext ?? 'png');

    // Replace custom extra params like {apiKey}
    for (const [key, val] of Object.entries(extraParams)) {
      urlPart = urlPart.replace(`{${key}}`, encodeURIComponent(val));
    }

    return url.replace(/\/$/, '') + urlPart;
  }

  if (style === 'kvp') {
    const qs = new URLSearchParams({
      SERVICE: 'WMTS',
      REQUEST: 'GetTile',
      VERSION: '1.0.0',
      ...kvpDefaults,
      LAYER: layer ?? '',
      STYLE: tileStyle ?? 'default',
      TILEMATRIXSET: tilematrixset ?? '',
      TILEMATRIX: String(z),
      TILEROW: String(y),
      TILECOL: String(x),
      FORMAT: extToMimeType(ext),
    });
    return `${url.replace(/\/$/, '')}?${qs.toString()}`;
  }

  throw new Error(`Unknown upstream style: ${style}`);
}

/**
 * Build the upstream URL for a GetCapabilities request.
 */
function buildCapabilitiesUrl(serviceCfg) {
  const { url, style, kvpDefaults = {} } = serviceCfg.upstream;
  if (style === 'kvp') {
    const qs = new URLSearchParams({
      SERVICE: 'WMTS',
      REQUEST: 'GetCapabilities',
      VERSION: '1.0.0',
      ...kvpDefaults,
    });
    return `${url.replace(/\/$/, '')}?${qs.toString()}`;
  }
  // REST & TMS: append /WMTSCapabilities.xml (OGC standard path)
  return `${url.replace(/\/$/, '')}/WMTSCapabilities.xml`;
}

function extToMimeType(ext) {
  const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pbf: 'application/x-protobuf' };
  return map[ext?.toLowerCase()] ?? 'image/png';
}

module.exports = { buildTileUrl, buildCapabilitiesUrl };
