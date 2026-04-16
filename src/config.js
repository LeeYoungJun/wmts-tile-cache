"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { z } = require("zod");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const ServiceSchema = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  cacheOnly: z.boolean().optional(),
  tileDefaults: z
    .object({
      layer: z.string().optional(),
      style: z.string().optional(),
      tilematrixset: z.string().optional(),
      ext: z.string().optional(),
    })
    .optional(),
  upstream: z.object({
    url: z.string().url(),
    style: z.enum(["rest", "kvp", "tms"]),
    restTemplate: z.string().optional(),
    kvpDefaults: z.record(z.string()).optional(),
    extraParams: z.record(z.string()).optional(),
  }),
  layers: z
    .object({
      allowlist: z.array(z.string()).optional(),
    })
    .optional(),
  cache: z
    .object({
      maxAgeDays: z.number().nullable().optional(),
    })
    .optional(),
  headers: z.record(z.string()).optional(),
});

const ConfigSchema = z.object({
  server: z
    .object({
      port: z.number().default(3000),
      logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
      corsOrigins: z.union([z.string(), z.array(z.string())]).default("*"),
    })
    .default({}),
  cache: z
    .object({
      directory: z.string().default("./cache"),
      maxAgeDays: z.number().nullable().default(30),
      capabilitiesTtlSeconds: z.number().default(300),
    })
    .default({}),
  services: z.array(ServiceSchema).default([]),
});

// ---------------------------------------------------------------------------
// Env var interpolation:  "${VAR_NAME}" → process.env.VAR_NAME
// ---------------------------------------------------------------------------
function interpolateEnv(value) {
  if (typeof value === "string") {
    return value.replace(
      /\$\{([^}]+)\}/g,
      (_, name) => process.env[name] ?? "",
    );
  }
  if (Array.isArray(value)) return value.map(interpolateEnv);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, interpolateEnv(v)]),
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Load & validate
// ---------------------------------------------------------------------------
let _config = null;

function loadConfig() {
  if (_config) return _config;

  const configPath = path.resolve(process.env.CONFIG_PATH ?? "./config.yaml");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = yaml.load(fs.readFileSync(configPath, "utf8"));
  const interpolated = interpolateEnv(raw);
  const result = ConfigSchema.safeParse(interpolated);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config validation failed:\n${issues}`);
  }

  _config = result.data;

  // Resolve cache directory relative to config file location
  if (!path.isAbsolute(_config.cache.directory)) {
    _config.cache.directory = path.resolve(
      path.dirname(configPath),
      _config.cache.directory,
    );
  }

  // Build a quick name → service lookup map
  _config._serviceMap = Object.fromEntries(
    _config.services.map((s) => [s.name, s]),
  );

  return _config;
}

function getService(name) {
  const cfg = loadConfig();
  return cfg._serviceMap[name] ?? null;
}

module.exports = { loadConfig, getService };
