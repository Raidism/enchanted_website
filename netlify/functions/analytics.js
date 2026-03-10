const { getStore } = require("@netlify/blobs");

const STORE_NAME = "imperium_analytics";
const LOGS_KEY = "view_logs";

const BLOBS_SITE_ID = String(
  process.env.NETLIFY_SITE_ID
    || process.env.SITE_ID
    || process.env.BLOBS_SITE_ID
    || ""
).trim();

const BLOBS_TOKEN = String(
  process.env.NETLIFY_AUTH_TOKEN
    || process.env.NETLIFY_API_TOKEN
    || process.env.BLOBS_TOKEN
    || ""
).trim();

const baseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (statusCode, payload) => ({
  statusCode,
  headers: baseHeaders,
  body: JSON.stringify(payload),
});

const getClientIpFromHeaders = (headers = {}) => {
  const lower = Object.create(null);
  Object.keys(headers || {}).forEach((key) => {
    lower[String(key).toLowerCase()] = headers[key];
  });

  const candidates = [
    lower["cf-connecting-ip"],
    lower["x-nf-client-connection-ip"],
    lower["x-forwarded-for"],
    lower["client-ip"],
  ];

  for (const value of candidates) {
    const first = String(value || "").split(",")[0].trim();
    if (first) {
      return first;
    }
  }

  return "Unknown";
};

const getAnalyticsStore = () => {
  if (!BLOBS_SITE_ID || !BLOBS_TOKEN) {
    throw new Error("Missing Netlify Blobs credentials for analytics.");
  }

  try {
    try {
      return getStore({
        name: STORE_NAME,
        siteID: BLOBS_SITE_ID,
        token: BLOBS_TOKEN,
      });
    } catch {
      return getStore(STORE_NAME, {
        siteID: BLOBS_SITE_ID,
        token: BLOBS_TOKEN,
      });
    }
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (message.toLowerCase().includes("not been configured to use netlify blobs")) {
      throw new Error("Netlify Blobs is not configured for analytics.");
    }

    throw error;
  }
};

const normalizeValue = (value, fallback = "Unknown") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const ensureLogShape = (log) => ({
  timestamp: String(log && log.timestamp ? log.timestamp : new Date().toISOString()),
  path: normalizeValue(log && log.path, "index.html"),
  ip: normalizeValue(log && log.ip),
  country: normalizeValue(log && log.country),
  countryCode: normalizeValue(log && log.countryCode, "--"),
  flag: normalizeValue(log && log.flag, "🌐"),
  device: normalizeValue(log && log.device),
  userAgent: normalizeValue(log && log.userAgent),
});

const readLogs = async () => {
  const store = getAnalyticsStore();
  const rows = await store.get(LOGS_KEY, { type: "json" });
  return Array.isArray(rows) ? rows.map(ensureLogShape) : [];
};

const writeLogs = async (rows) => {
  const store = getAnalyticsStore();
  await store.setJSON(LOGS_KEY, rows.slice(0, 2000));
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: baseHeaders,
        body: "",
      };
    }

    if (event.httpMethod === "GET") {
      const logs = await readLogs();
      return json(200, { success: true, logs });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { success: false, message: "Method not allowed." });
    }

    if (String(event.body || "").length > 12_000) {
      return json(413, { success: false, message: "Payload too large." });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { success: false, message: "Invalid JSON payload." });
    }

    const action = String(payload.action || "track").trim();

    if (action !== "track") {
      return json(400, { success: false, message: "Unsupported action." });
    }

    const entry = ensureLogShape({
      ...(payload.entry || {}),
      ip: getClientIpFromHeaders(event.headers || {}),
    });
    const logs = await readLogs();
    logs.unshift(entry);
    await writeLogs(logs);

    return json(200, {
      success: true,
      message: "Tracked.",
      total: logs.length,
    });
  } catch (error) {
    return json(500, {
      success: false,
      message: "Server error while processing analytics.",
      error: String(error && error.message ? error.message : error),
    });
  }
};
