"use strict";

const path = require("path");
const { loadConfig } = require("../config");

function sanitizeSegment(value) {
  const v = String(value ?? "");
  if (!v) return "_";
  return v.replace(/[\\/:*?"<>|]/g, "_");
}

function tileCachePath(params) {
  const cfg = loadConfig();
  const service = sanitizeSegment(params.service);

  const ext = sanitizeSegment(params.ext ?? "png").replace(/^\.+/, "") || "png";
  const z = sanitizeSegment(params.z);
  const y = sanitizeSegment(params.y);
  const x = sanitizeSegment(params.x);

  const isTmsLike = !params.layer && !params.style && !params.tilematrixset;
  if (isTmsLike) {
    return path.join(cfg.cache.directory, service, z, y, `${x}.${ext}`);
  }

  const layer = sanitizeSegment(params.layer ?? "_");
  const style = sanitizeSegment(params.style ?? "default");
  const tms = sanitizeSegment(params.tilematrixset ?? "_");

  return path.join(
    cfg.cache.directory,
    service,
    layer,
    style,
    tms,
    z,
    y,
    `${x}.${ext}`,
  );
}

module.exports = { tileCachePath };
