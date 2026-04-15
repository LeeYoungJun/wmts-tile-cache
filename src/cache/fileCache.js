"use strict";

const fs = require("fs/promises");
const path = require("path");

async function readTile(filePath) {
  try {
    const [buffer, stat] = await Promise.all([
      fs.readFile(filePath),
      fs.stat(filePath),
    ]);

    return {
      buffer,
      contentType: contentTypeFromPath(filePath),
      mtime: stat.mtime,
    };
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

async function writeTile(filePath, buffer) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  } catch (_err) {
    // Cache write failures are non-fatal by design.
  }
}

async function countCachedTiles(rootDir) {
  try {
    const rootStat = await fs.stat(rootDir);
    if (!rootStat.isDirectory()) return 0;
  } catch (err) {
    if (err && err.code === "ENOENT") return 0;
    throw err;
  }

  let count = 0;
  const stack = [rootDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && isTileFile(entry.name)) {
        count += 1;
      }
    }
  }

  return count;
}

function isTileFile(name) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".pbf") ||
    lower.endsWith(".mvt")
  );
}

function contentTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".pbf":
      return "application/x-protobuf";
    case ".mvt":
      return "application/vnd.mapbox-vector-tile";
    default:
      return "application/octet-stream";
  }
}

module.exports = { readTile, writeTile, countCachedTiles };
