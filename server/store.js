const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const READ_CACHE_TTL_MS = 1200;
const readCache = new Map();

const cloneValue = (value) => {
  if (value === null || typeof value !== "object") {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const filePath = (name) => path.join(dataDir, `${name}.json`);

const readJson = (name, fallback) => {
  ensureDataDir();
  const cacheKey = String(name || "");
  const cached = readCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneValue(cached.value);
  }

  const fullPath = filePath(name);

  if (!fs.existsSync(fullPath)) {
    readCache.set(cacheKey, {
      value: fallback,
      expiresAt: Date.now() + READ_CACHE_TTL_MS,
    });
    return fallback;
  }

  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    readCache.set(cacheKey, {
      value: parsed,
      expiresAt: Date.now() + READ_CACHE_TTL_MS,
    });
    return cloneValue(parsed);
  } catch {
    readCache.set(cacheKey, {
      value: fallback,
      expiresAt: Date.now() + READ_CACHE_TTL_MS,
    });
    return fallback;
  }
};

const writeJson = (name, value) => {
  ensureDataDir();
  const cacheKey = String(name || "");
  const fullPath = filePath(name);
  const tempPath = `${fullPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tempPath, fullPath);

  readCache.set(cacheKey, {
    value: cloneValue(value),
    expiresAt: Date.now() + READ_CACHE_TTL_MS,
  });
};

module.exports = {
  readJson,
  writeJson,
};
