# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Production
npm start           # node src/server.js

# Development (auto-restart on changes)
npm run dev         # nodemon src/server.js
```

There is no test suite. There are no lint scripts defined.

**Environment variables** are loaded via `dotenv` from a `.env` file in the project root. Example:

```
VWORLD_API_KEY=your_key_here
PORT=3000
CONFIG_PATH=./config.yaml   # optional override
```

## Architecture

This is a lightweight WMTS tile caching proxy — a Node.js/Express alternative to MapProxy. It sits between a map client and upstream tile services, caching tiles on disk.

### Request flow

```
Client → Express → router.js → handler → cache check → upstream fetch → disk write → response
```

1. **`src/server.js`** — boots Express, loads config, mounts all routes under `/wmts`
2. **`src/router.js`** — routes to three handlers: `getTile`, `getCapabilities`, and `stats`
3. **`src/handlers/getTile.js`** — checks disk cache; on miss, builds upstream URL, fetches, writes to disk non-blocking, returns tile
4. **`src/handlers/getCapabilities.js`** — proxies GetCapabilities with an in-memory TTL cache (not disk)
5. **`src/upstream/urlBuilder.js`** — builds upstream tile/capabilities URLs from service config; supports three upstream styles (`rest`, `kvp`, `tms`)
6. **`src/upstream/fetcher.js`** — HTTP fetch via `got`
7. **`src/cache/cacheKey.js`** — maps tile params to a filesystem path
8. **`src/cache/fileCache.js`** — read/write tiles from disk; cache write errors are swallowed (non-fatal)
9. **`src/stats.js`** — in-memory counters (hits/misses/errors per service); resets on restart

### URL patterns

| Pattern                                               | Purpose                                               |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `GET /wmts/_stats`                                    | JSON stats (hit ratio, cached tile count per service) |
| `GET /wmts/_health`                                   | Health check                                          |
| `GET /wmts/:service/WMTSCapabilities.xml`             | GetCapabilities (REST)                                |
| `GET /wmts/:service?REQUEST=GetCapabilities`          | GetCapabilities (KVP)                                 |
| `GET /wmts/:service/:layer/:style/:tms/:z/:y/:x.:ext` | GetTile (full WMTS REST)                              |
| `GET /wmts/:service/:z/:y/:x.:ext`                    | GetTile (TMS shorthand)                               |
| `GET /wmts/:service?REQUEST=GetTile&...`              | GetTile (KVP)                                         |

### Configuration (`config.yaml`)

Validated at startup with Zod. Environment variable interpolation uses `${VAR_NAME}` syntax in YAML string values. Config is a singleton — cached after first load.

Each **service** entry defines:

- `upstream.style`: `rest` | `kvp` | `tms` — determines URL construction
- `upstream.restTemplate`: path template with `{layer}`, `{z}`, `{y}`, `{x}`, `{ext}`, `{apiKey}`, etc.
- `upstream.extraParams`: arbitrary template variables injected into `restTemplate`
- `layers.allowlist`: if non-empty, blocks requests for unlisted layers (403)
- `cache.maxAgeDays`: per-service override; falls back to global `cache.maxAgeDays`

### Disk cache layout

```
cache/
  {service}/
    _capabilities.xml         # GetCapabilities response (not used — see note)
    {layer}/{style}/{tms}/
      {z}/{y}/{x}.{ext}       # WMTS tiles
  osm/                        # TMS-style: no layer/style/tms segments
    {z}/{y}/{x}.png
```

> Note: `capabilitiesCachePath` exists in `cacheKey.js` but GetCapabilities currently uses in-memory TTL only (not disk). The disk path is unused.

### Adding a new upstream service

Add a new entry to `services` in `config.yaml`. No code changes required. The three `style` values cover all common tile server patterns.
