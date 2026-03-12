const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const filePath = (name) => path.join(dataDir, `${name}.json`);

const readJson = (name, fallback) => {
  ensureDataDir();
  const fullPath = filePath(name);

  if (!fs.existsSync(fullPath)) {
    return fallback;
  }

  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = (name, value) => {
  ensureDataDir();
  const fullPath = filePath(name);
  const tempPath = `${fullPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tempPath, fullPath);
};

module.exports = {
  readJson,
  writeJson,
};
