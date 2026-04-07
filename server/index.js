const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const useragent = require("express-useragent"); // new dep
const geoip = require("geoip-lite"); // new dep
const { readJson, writeJson } = require("./store");

const app = express();
app.use(useragent.express());
app.disable("x-powered-by");
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3001);
const SESSION_COOKIE = "enchanted_sid";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const ACCESS_GATE_COOKIE = "enchanted_access_gate";
const ACCESS_GATE_TTL_MS = 2 * 60 * 60 * 1000;
const ACCESS_GATE_MAX_ATTEMPTS = 5;
const ACCESS_GATE_LOCKOUT_MS = 10 * 60 * 1000;
const ACCESS_GATE_PASSWORD = "1001";
const ACCESS_GATE_SECRET = String(process.env.ACCESS_GATE_SECRET || process.env.SESSION_SECRET || "enchanted-access-secret");
const ACCESS_GATE_PASSWORD_HASH = crypto.createHash("sha256").update(ACCESS_GATE_PASSWORD).digest("hex");
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PUBLIC_WRITES = 80;
const RATE_LIMIT_MAX_WAITLIST_WRITES = 24;
const RATE_LIMIT_MAX_QUESTION_WRITES = 8;
const RATE_LIMIT_MAX_LOGIN_ATTEMPTS = 18;
const RATE_LIMIT_MAX_ACCESS_GATE_ATTEMPTS = 25;
const QUESTION_DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
const QUESTION_COOLDOWN_MS = 90 * 1000;
const STATIC_SHORT_CACHE_SECONDS = 60 * 60;
const STATIC_LONG_CACHE_SECONDS = 60 * 60 * 24 * 7;
const SITE_SETTINGS_CACHE_MS = 10 * 1000;
const DEPLOY_STATUS_CACHE_MS = 5 * 1000;
const INSTAGRAM_CACHE_MS = 45 * 1000;

const PAGE_ROUTE_FILES = {
  "/": "index.html",
  "/access": "access-gate.html",
  "/portal": "access.html",
  "/maintenance": "maintenance.html",
  "/contact": "contact-adham.html",
  "/dashboard": "dashboard.html",
  "/apply": "apply.html",
  "/applications": "applications.html",
  "/applications/team": "applications-team.html",
  "/waitlist": "applications.html",
  "/settings": "settings.html",
  "/ops": "ops.html",
  "/locked": "locked.html",
};

const LEGACY_PAGE_REDIRECTS = {
  "/index.html": "/",
  "/access-gate.html": "/access",
  "/access.html": "/portal",
  "/maintenance.html": "/maintenance",
  "/contact-adham": "/contact",
  "/contact-adham.html": "/contact",
  "/dashboard.html": "/dashboard",
  "/applications.html": "/applications",
  "/applications-team.html": "/applications/team",
  "/waitlist.html": "/applications",
  "/settings.html": "/settings",
  "/ops.html": "/ops",
  "/locked.html": "/locked",
};

const MAINTENANCE_BYPASS_ROUTES = new Set([
  "/access",
  "/portal",
  "/maintenance",
]);

const accessGateAttempts = new Map();
const requestRateBuckets = new Map();
let cachedSiteSettingsPayload = null;
let cachedDeployStatusPayload = null;
let cachedInstagramPayload = null;

const defaultSiteSettings = {
  maintenanceMode: false,
  maintenanceMessage: "The Enchanted Summit is temporarily under maintenance. Please check back soon.",
  launchDate: "2026-03-28T00:00:00+03:00",
  announcement: "",
  teamApplicationsOpen: false,
  applicationsOpen: false,
  conferenceDate: "",
  locationText: "Riyadh, KSA",
  conferenceDescription: "The Enchanted Summit is a debate summit rooted in fictional and otherworldly topics, designed to bring out the passion of participants in the debate community.",
  countdownEnabled: false,
  instagramStatsSource: "live",
  instagramFollowers: 135,
  instagramPosts: 3,
  instagramFollowing: 5,
};

const defaultDeployStatus = {
  active: false,
  phase: "idle",
  message: "No deployment in progress.",
  progress: 0,
  startedAt: "",
  updatedAt: "",
  completedAt: "",
  failedAt: "",
  target: "",
  commit: "",
  releaseTag: "",
};

const DEFAULT_USERS = [
  { username: "admin", password: "Soliman123@", role: "admin", name: "Adham Soliman", photo: "assets/adham pic.jpg" },
];

const nowIso = () => new Date().toISOString();
const normalizeUsername = (v) => String(v || "").trim().toLowerCase();

const createSignedToken = (expiresAtMs) => {
  const payload = String(expiresAtMs);
  const signature = crypto.createHmac("sha256", ACCESS_GATE_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
};

const verifySignedToken = (token) => {
  const raw = String(token || "").trim();
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return false;

  const expiresAtMs = Number(payload);
  if (!Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs) return false;

  const expectedSignature = crypto.createHmac("sha256", ACCESS_GATE_SECRET).update(payload).digest("hex");
  if (signature.length !== expectedSignature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

const setAccessGateCookie = (res) => {
  const expiresAtMs = Date.now() + ACCESS_GATE_TTL_MS;
  const token = createSignedToken(expiresAtMs);
  res.cookie(ACCESS_GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    expires: new Date(expiresAtMs),
    path: "/",
  });
};

const clearAccessGateCookie = (res) => {
  res.clearCookie(ACCESS_GATE_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
};

const readUsers = () => readJson("users", []);
const writeUsers = (users) => writeJson("users", users);
const readSessions = () => readJson("sessions", {});
const writeSessions = (sessions) => writeJson("sessions", sessions);
const readHistory = () => readJson("login_history", []);
const writeHistory = (history) => writeJson("login_history", history);
// Analytics storage is normalized to a simple array of log objects.
// Older shapes like { clicks: [], visits: [] } are migrated in-memory.
const readAnalytics = () => {
  const raw = readJson("analytics_logs", null);
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw;
  }

  if (raw && Array.isArray(raw.clicks)) {
    return raw.clicks;
  }

  if (raw && Array.isArray(raw.visits)) {
    return raw.visits;
  }

  return [];
};

const writeAnalytics = (rows) => {
  const normalized = Array.isArray(rows) ? rows : [];
  return writeJson("analytics_logs", normalized);
};
const readSettings = () => ({ ...defaultSiteSettings, ...readJson("site_settings", {}) });
const writeSettings = (settings) => writeJson("site_settings", { ...defaultSiteSettings, ...settings });
const readDeployStatus = () => ({ ...defaultDeployStatus, ...readJson("deploy_status", {}) });
const writeDeployStatus = (status) => writeJson("deploy_status", { ...defaultDeployStatus, ...status });
const readWaitlist = () => readJson("waitlist_entries", []);
const writeWaitlist = (rows) => writeJson("waitlist_entries", rows.slice(0, 3000));
const readDeletedWaitlist = () => readJson("waitlist_deleted", []);
const writeDeletedWaitlist = (rows) => writeJson("waitlist_deleted", rows.slice(0, 500));
const readQuestions = () => readJson("questions", []);
const writeQuestions = (rows) => writeJson("questions", rows.slice(0, 3000));

const createSeedUser = (user) => ({
  ...user,
  passwordHash: bcrypt.hashSync(String(user.password), 10),
  disabled: false,
  onboardingCompleted: Boolean(user.onboardingCompleted),
});

const ensureSeedData = () => {
  const users = readUsers();
  if (!Array.isArray(users) || users.length === 0) {
    const seeded = DEFAULT_USERS.map((u) => createSeedUser(u));
    writeUsers(seeded);
  } else {
    let changed = false;
    const normalizedUsers = users.map((u) => {
      if (typeof u.onboardingCompleted === "boolean") {
        return u;
      }
      changed = true;
      return {
        ...u,
        onboardingCompleted: false,
      };
    });

    const existingUsernames = new Set(
      normalizedUsers.map((u) => normalizeUsername(u.username))
    );

    DEFAULT_USERS.forEach((defaultUser) => {
      const key = normalizeUsername(defaultUser.username);
      if (!existingUsernames.has(key)) {
        normalizedUsers.push(createSeedUser(defaultUser));
        existingUsernames.add(key);
        changed = true;
      }
    });

    if (changed) {
      writeUsers(normalizedUsers);
    }
  }

  const settings = readJson("site_settings", null);
  if (!settings || typeof settings !== "object") {
    writeSettings(defaultSiteSettings);
  }

  if (!Array.isArray(readHistory())) {
    writeHistory([]);
  }

  if (!readSessions() || typeof readSessions() !== "object") {
    writeSessions({});
  }

  if (!Array.isArray(readWaitlist())) {
    writeWaitlist([]);
  }

  if (!Array.isArray(readDeletedWaitlist())) {
    writeDeletedWaitlist([]);
  }

  if (!Array.isArray(readQuestions())) {
    writeQuestions([]);
  }

  // Ensure analytics log file exists in normalized array format.
  if (!Array.isArray(readAnalytics())) {
    writeAnalytics([]);
  }

  const deployStatus = readJson("deploy_status", null);
  if (!deployStatus || typeof deployStatus !== "object") {
    writeDeployStatus(defaultDeployStatus);
  }
};

const sanitizeUser = (user) => ({
  username: user.username,
  role: user.role || "member",
  disabled: Boolean(user.disabled),
  name: String(user.name || ""),
  photo: String(user.photo || ""),
  onboardingCompleted: Boolean(user.onboardingCompleted),
});

const sanitizeUserForAdmin = (user) => ({
  username: user.username,
  passwordMasked: String(user.passwordHash || user.password ? "********" : ""),
  role: user.role || "member",
  disabled: Boolean(user.disabled),
  name: String(user.name || ""),
  photo: String(user.photo || ""),
  onboardingCompleted: Boolean(user.onboardingCompleted),
});

const getSession = (req) => {
  const sid = String(req.cookies && req.cookies[SESSION_COOKIE] ? req.cookies[SESSION_COOKIE] : "").trim();
  if (!sid) return null;

  const sessions = readSessions();
  const session = sessions[sid];
  if (!session) return null;

  const expiresAt = new Date(String(session.expiresAt || ""));
  if (Number.isNaN(expiresAt.getTime()) || Date.now() >= expiresAt.getTime()) {
    delete sessions[sid];
    writeSessions(sessions);
    return null;
  }

  return { sid, session, sessions };
};

const isAdminRequest = (req) => {
  const found = getSession(req);
  if (!found) return false;

  const users = readUsers();
  const user = users.find((u) => normalizeUsername(u.username) === normalizeUsername(found.session.username));
  return Boolean(user && !user.disabled && user.role === "admin");
};

const setSessionCookie = (res, sid, expiresAtIso) => {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    expires: new Date(expiresAtIso),
    path: "/",
  });
};

const clearSessionCookie = (res) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
};

const requireAuth = (req, res, next) => {
  const found = getSession(req);
  if (!found) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  const users = readUsers();
  const user = users.find((u) => normalizeUsername(u.username) === normalizeUsername(found.session.username));
  if (!user || user.disabled) {
    delete found.sessions[found.sid];
    writeSessions(found.sessions);
    clearSessionCookie(res);
    return res.status(401).json({ success: false, message: "Session is no longer valid." });
  }

  req.auth = {
    sid: found.sid,
    sessions: found.sessions,
    user,
    session: found.session,
  };

  return next();
};

const requireAdmin = (req, res, next) => {
  if (!req.auth || req.auth.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Only admin can perform this action." });
  }
  return next();
};

const mainAdminOnly = (req, res, next) => {
  if (normalizeUsername(req.auth.user.username) !== "admin") {
    return res.status(403).json({ success: false, message: "Only the main admin account can change user access." });
  }
  return next();
};

const getClientIpFromHeaders = (headers = {}) => {
  const lower = Object.create(null);
  Object.keys(headers || {}).forEach((key) => {
    lower[String(key).toLowerCase()] = headers[key];
  });

  const candidates = [
    lower["cf-connecting-ip"],
    lower["x-forwarded-for"],
    lower["x-real-ip"],
    lower["x-nf-client-connection-ip"],
  ];

  for (const value of candidates) {
    const first = String(value || "").split(",")[0].trim();
    if (first) return first;
  }
  return "Unknown";
};

const getRequestIp = (req) => {
  const candidate = String(getClientIpFromHeaders(req && req.headers ? req.headers : {}) || "").trim();
  if (candidate) return candidate;
  return String(req && req.ip ? req.ip : "unknown").trim() || "unknown";
};

const createRateLimit = ({ keyPrefix, windowMs, maxRequests }) => (req, res, next) => {
  const now = Date.now();
  const bucketKey = `${keyPrefix}:${getRequestIp(req)}`;
  const record = requestRateBuckets.get(bucketKey);

  if (!record || now >= record.resetAt) {
    requestRateBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return next();
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please try again shortly.",
      retryAfterSeconds,
    });
  }

  record.count += 1;
  requestRateBuckets.set(bucketKey, record);
  return next();
};

const publicWriteRateLimit = createRateLimit({
  keyPrefix: "public-write",
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_PUBLIC_WRITES,
});

const waitlistWriteRateLimit = createRateLimit({
  keyPrefix: "waitlist-write",
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_WAITLIST_WRITES,
});

const questionWriteRateLimit = createRateLimit({
  keyPrefix: "question-write",
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_QUESTION_WRITES,
});

const loginRateLimit = createRateLimit({
  keyPrefix: "auth-login",
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_LOGIN_ATTEMPTS,
});

const accessGateRateLimit = createRateLimit({
  keyPrefix: "access-gate",
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_ACCESS_GATE_ATTEMPTS,
});

const normalizeWaitlistEntry = (entry) => ({
  id: String(entry.id || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`),
  name: String(entry.name || "").trim(),
  email: String(entry.email || "").trim().toLowerCase(),
  school: String(entry.school || "").trim(),
  role: String(entry.role || "delegate").trim(),
  addedAt: String(entry.addedAt || nowIso()),
  status: String(entry.status || "pending"),
  reviewedAt: String(entry.reviewedAt || ""),
  reviewedBy: String(entry.reviewedBy || ""),
  notified: Boolean(entry.notified),
  notifiedAt: String(entry.notifiedAt || ""),
});

const normalizeQuestionText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const normalizeQuestionEntry = (entry) => ({
  id: String(entry.id || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`),
  name: String(entry.name || "").trim(),
  email: String(entry.email || "").trim().toLowerCase(),
  question: normalizeQuestionText(entry.question),
  isAnonymous: Boolean(entry.isAnonymous),
  status: String(entry.status || "new").trim().toLowerCase(),
  replyText: normalizeQuestionText(entry.replyText),
  createdAt: String(entry.createdAt || nowIso()),
  updatedAt: String(entry.updatedAt || entry.createdAt || nowIso()),
  repliedAt: String(entry.repliedAt || ""),
  repliedBy: String(entry.repliedBy || "").trim(),
  sourcePath: String(entry.sourcePath || "/").trim().slice(0, 120),
  ip: String(entry.ip || "Unknown").trim().slice(0, 80),
  userAgent: String(entry.userAgent || "Unknown").trim().slice(0, 280),
});

const VALID_STATUSES = new Set(["pending", "green", "red", "saved"]);
const VALID_QUESTION_STATUSES = new Set(["new", "reviewing", "replied", "resolved", "spam"]);

const getQuestionFingerprint = (value) => normalizeQuestionText(value).toLowerCase();

const hasSpammyCharacterRun = (value) => /(.)\1{24,}/i.test(String(value || ""));

const looksLikeQuestionSpam = (value) => {
  const text = normalizeQuestionText(value);
  if (!text) return false;
  if (/(https?:\/\/|www\.)/i.test(text)) return true;
  if (hasSpammyCharacterRun(text)) return true;
  return false;
};

const readCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric);
};

const toCountryFlag = (countryCode) => {
  const normalized = String(countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return "🌐";
  }
  return String.fromCodePoint(...[...normalized].map((char) => 127397 + char.charCodeAt(0)));
};

const inferGeoFromIp = (ipRaw) => {
  const ip = String(ipRaw || "").trim();
  if (!ip || ip === "Unknown") {
    return { country: "Unknown", countryCode: "--", flag: "🌐" };
  }

  const cleanIp = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const lookup = geoip.lookup(cleanIp);
  if (!lookup) {
    return { country: "Unknown", countryCode: "--", flag: "🌐" };
  }

  const countryCode = String(lookup.country || "--").toUpperCase();
  const country = String(lookup.country || "Unknown");
  return {
    country,
    countryCode,
    flag: toCountryFlag(countryCode),
  };
};

const normalizeInstagramStats = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const followers = readCount(raw.followers);
  const following = readCount(raw.following);
  const posts = readCount(raw.posts);
  if (followers === null || following === null || posts === null) return null;
  return { followers, following, posts };
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const getInstagramLiveStats = async (username) => {
  const webApi = async () => {
    const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "X-IG-App-ID": "936619743392459",
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error("web api failed");
    const payload = await response.json();
    const user = payload && payload.data && payload.data.user;
    const stats = normalizeInstagramStats({
      followers: user && user.edge_followed_by && user.edge_followed_by.count,
      following: user && user.edge_follow && user.edge_follow.count,
      posts: user && user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.count,
    });
    if (!stats) throw new Error("invalid stats");
    return stats;
  };

  const legacy = async () => {
    const url = `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`;
    const response = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
    if (!response.ok) throw new Error("legacy failed");
    const payload = await response.json();
    const user = payload && payload.graphql && payload.graphql.user;
    const stats = normalizeInstagramStats({
      followers: user && user.edge_followed_by && user.edge_followed_by.count,
      following: user && user.edge_follow && user.edge_follow.count,
      posts: user && user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.count,
    });
    if (!stats) throw new Error("invalid stats");
    return stats;
  };

  const readers = [webApi, legacy];
  for (const reader of readers) {
    try {
      const stats = await reader();
      return { ...stats, stale: false, source: "live" };
    } catch {
      // try next
    }
  }

  const fallback = readSettings();
  return {
    followers: Number(fallback.instagramFollowers) || defaultSiteSettings.instagramFollowers,
    posts: Number(fallback.instagramPosts) || defaultSiteSettings.instagramPosts,
    following: Number(fallback.instagramFollowing) || defaultSiteSettings.instagramFollowing,
    stale: true,
    source: "fallback",
  };
};

ensureSeedData();

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  if (String(req.path || "").startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
  }

  return next();
});

app.use((req, res, next) => {
  if (String(req.path || "").startsWith("/api/")) {
    return next();
  }

  if (req.method !== "GET") {
    return next();
  }

  const accepts = String(req.headers && req.headers.accept ? req.headers.accept : "").toLowerCase();
  if (!accepts.includes("text/html")) {
    return next();
  }

  const settings = readSettings();
  if (!settings.maintenanceMode) {
    return next();
  }

  if (MAINTENANCE_BYPASS_ROUTES.has(req.path)) {
    return next();
  }

  if (isAdminRequest(req)) {
    return next();
  }

  return res.redirect(302, "/maintenance");
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "ok", time: nowIso() });
});

app.post("/api/access-gate/verify", accessGateRateLimit, (req, res) => {
  const ip = getClientIpFromHeaders(req.headers);
  const record = accessGateAttempts.get(ip) || { failedAttempts: 0, lockoutUntil: 0 };

  const passwordInput = String(req.body && req.body.password ? req.body.password : "");
  if (!passwordInput) {
    return res.status(400).json({ success: false, message: "Password is required." });
  }

  const inputHash = crypto.createHash("sha256").update(passwordInput).digest("hex");
  const passwordMatches = crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(ACCESS_GATE_PASSWORD_HASH));

  if (passwordMatches) {
    accessGateAttempts.delete(ip);
    setAccessGateCookie(res);
    return res.json({ success: true, redirectPath: "/portal" });
  }

  if (record.lockoutUntil && Date.now() < record.lockoutUntil) {
    const retryMs = Math.max(0, record.lockoutUntil - Date.now());
    return res.status(429).json({
      success: false,
      message: "Too many wrong attempts. Try again later.",
      retryMs,
    });
  }

  if (!passwordMatches) {
    const nextFailedAttempts = record.failedAttempts + 1;
    if (nextFailedAttempts >= ACCESS_GATE_MAX_ATTEMPTS) {
      const lockoutUntil = Date.now() + ACCESS_GATE_LOCKOUT_MS;
      accessGateAttempts.set(ip, { failedAttempts: nextFailedAttempts, lockoutUntil });
      return res.status(429).json({
        success: false,
        message: "Too many wrong attempts. Try again later.",
        retryMs: ACCESS_GATE_LOCKOUT_MS,
      });
    }

    accessGateAttempts.set(ip, { failedAttempts: nextFailedAttempts, lockoutUntil: 0 });
    return res.status(401).json({
      success: false,
      message: "Wrong password.",
      attemptsLeft: ACCESS_GATE_MAX_ATTEMPTS - nextFailedAttempts,
    });
  }
});

app.post("/api/auth/login", loginRateLimit, (req, res) => {
  const usernameInput = String(req.body && req.body.username ? req.body.username : "").trim();
  const passwordInput = String(req.body && req.body.password ? req.body.password : "");

  if (!usernameInput || !passwordInput) {
    return res.status(400).json({ success: false, message: "Username and password are required." });
  }

  const users = readUsers();
  const user = users.find((u) => normalizeUsername(u.username) === normalizeUsername(usernameInput));
  if (!user) {
    return res.status(401).json({ success: false, message: "Wrong username or password." });
  }

  if (user.disabled) {
    return res.status(403).json({ success: false, message: "This account is disabled. Contact admin." });
  }

  const passwordOk = user.passwordHash ? bcrypt.compareSync(passwordInput, user.passwordHash) : String(user.password || "") === passwordInput;
  if (!passwordOk) {
    return res.status(401).json({ success: false, message: "Wrong username or password." });
  }

  const settings = readSettings();
  if (settings.maintenanceMode && user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: settings.maintenanceMessage || "Website is under maintenance. Please try again later.",
    });
  }

  const sid = crypto.randomBytes(32).toString("hex");
  const expiresAtIso = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const sessions = readSessions();
  sessions[sid] = {
    username: user.username,
    role: user.role || "member",
    name: String(user.name || ""),
    photo: String(user.photo || ""),
    loginAt: nowIso(),
    lastSeenAt: nowIso(),
    expiresAt: expiresAtIso,
  };
  writeSessions(sessions);

  const history = readHistory();
  history.unshift({ username: user.username, role: user.role || "member", loginAt: nowIso() });
  writeHistory(history.slice(0, 250));

  setSessionCookie(res, sid, expiresAtIso);

  return res.json({ success: true, user: sanitizeUser(user) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  delete req.auth.sessions[req.auth.sid];
  writeSessions(req.auth.sessions);
  clearSessionCookie(res);
  res.json({ success: true, message: "Logged out." });
});

app.get("/api/auth/me", (req, res) => {
  const found = getSession(req);
  if (!found) {
    clearSessionCookie(res);
    return res.status(401).json({ success: false, message: "No active session." });
  }

  const users = readUsers();
  const user = users.find((u) => normalizeUsername(u.username) === normalizeUsername(found.session.username));
  if (!user || user.disabled) {
    delete found.sessions[found.sid];
    writeSessions(found.sessions);
    clearSessionCookie(res);
    return res.status(401).json({ success: false, message: "Session is no longer valid." });
  }

  return res.json({ success: true, user: sanitizeUser(user) });
});

app.post("/api/auth/heartbeat", requireAuth, (req, res) => {
  req.auth.session.lastSeenAt = nowIso();
  req.auth.session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  req.auth.sessions[req.auth.sid] = req.auth.session;
  writeSessions(req.auth.sessions);
  setSessionCookie(res, req.auth.sid, req.auth.session.expiresAt);
  res.json({ success: true });
});

app.get("/api/auth/onboarding", requireAuth, (req, res) => {
  return res.json({
    success: true,
    onboardingCompleted: Boolean(req.auth.user.onboardingCompleted),
  });
});

app.post("/api/auth/onboarding/complete", requireAuth, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex((u) => normalizeUsername(u.username) === normalizeUsername(req.auth.user.username));
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  users[idx].onboardingCompleted = true;
  writeUsers(users);
  return res.json({ success: true, onboardingCompleted: true });
});

app.get("/api/auth/history", requireAuth, requireAdmin, (_req, res) => {
  res.json({ success: true, rows: readHistory() });
});

app.get("/api/users", requireAuth, requireAdmin, (_req, res) => {
  res.json({ success: true, users: readUsers().map(sanitizeUserForAdmin) });
});

app.post("/api/users", requireAuth, requireAdmin, (req, res) => {
  const username = String(req.body && req.body.username ? req.body.username : "").trim();
  const password = String(req.body && req.body.password ? req.body.password : "").trim();
  const role = String(req.body && req.body.role ? req.body.role : "member").trim().toLowerCase() === "admin" ? "admin" : "member";

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required." });
  }

  const users = readUsers();
  const exists = users.some((u) => normalizeUsername(u.username) === normalizeUsername(username));
  if (exists) {
    return res.status(409).json({ success: false, message: "Username already exists." });
  }

  users.push({
    username,
    password,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    disabled: false,
    name: "",
    photo: "",
    onboardingCompleted: false,
  });

  writeUsers(users);
  return res.json({ success: true, message: "User added successfully." });
});

app.post("/api/users/disable", requireAuth, requireAdmin, mainAdminOnly, (req, res) => {
  const username = String(req.body && req.body.username ? req.body.username : "").trim();
  const disabled = Boolean(req.body && req.body.disabled);
  if (!username) {
    return res.status(400).json({ success: false, message: "Username is required." });
  }

  const users = readUsers();
  const idx = users.findIndex((u) => normalizeUsername(u.username) === normalizeUsername(username));
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  if (normalizeUsername(users[idx].username) === "admin") {
    return res.status(400).json({ success: false, message: "Admin access cannot be disabled." });
  }

  users[idx].disabled = disabled;
  writeUsers(users);

  if (disabled) {
    const sessions = readSessions();
    Object.keys(sessions).forEach((sid) => {
      if (normalizeUsername(sessions[sid].username) === normalizeUsername(username)) {
        delete sessions[sid];
      }
    });
    writeSessions(sessions);
  }

  return res.json({ success: true, message: `User ${users[idx].username} ${disabled ? "disabled" : "enabled"}.` });
});

app.post("/api/users/force-logout", requireAuth, requireAdmin, (req, res) => {
  const username = String(req.body && req.body.username ? req.body.username : "").trim();
  if (!username) {
    return res.status(400).json({ success: false, message: "Username required." });
  }

  if (normalizeUsername(username) === normalizeUsername(req.auth.user.username)) {
    return res.status(400).json({ success: false, message: "You cannot force-logout yourself." });
  }

  const sessions = readSessions();
  Object.keys(sessions).forEach((sid) => {
    if (normalizeUsername(sessions[sid].username) === normalizeUsername(username)) {
      delete sessions[sid];
    }
  });
  writeSessions(sessions);

  return res.json({ success: true, message: `${username} has been force-logged out.` });
});

app.get("/api/sessions/active", requireAuth, requireAdmin, (_req, res) => {
  const sessions = readSessions();
  const map = {};

  Object.values(sessions).forEach((session) => {
    const key = String(session.username || "");
    if (!key) return;

    if (!map[key] || String(map[key].lastSeenAt || "") < String(session.lastSeenAt || "")) {
      map[key] = {
        username: key,
        role: String(session.role || "member"),
        loginAt: String(session.loginAt || ""),
        lastSeenAt: String(session.lastSeenAt || ""),
      };
    }
  });

  res.json({ success: true, activeUsers: map });
});

app.post("/api/analytics/track", publicWriteRateLimit, (req, res) => {
  const { event, label } = req.body || {};
  if (!event) return res.json({ success: false });

  // Validate field types and lengths to prevent log injection
  const safeEvent = String(event).substring(0, 50);
  const safeLabel = String(label || "").substring(0, 100);
  if (!safeEvent) return res.json({ success: false });

  const clicks = readAnalytics();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: nowIso(),
    event: safeEvent,
    label: safeLabel,
    ip: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim().substring(0, 64),
    userAgent: String(req.useragent ? req.useragent.source : "unknown").substring(0, 256),
  };
  
  if (req.useragent) {
    entry.browser = req.useragent.browser;
    entry.os = req.useragent.os;
    entry.platform = req.useragent.platform;
  }

  clicks.push(entry);
  // Optional: Rotate logs if too large
  if (clicks.length > 5000) {
    clicks.splice(0, clicks.length - 5000);
  }

  writeAnalytics(clicks);
  res.json({ success: true });
});

app.get("/api/analytics/clicks", requireAuth, requireAdmin, (_req, res) => {
  const clicks = readAnalytics();
  res.json({ success: true, clicks });
});

app.get("/api/site-settings", (_req, res) => {
  const now = Date.now();
  if (cachedSiteSettingsPayload && now < cachedSiteSettingsPayload.expiresAt) {
    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
    return res.json(cachedSiteSettingsPayload.payload);
  }

  const payload = { success: true, settings: readSettings() };
  cachedSiteSettingsPayload = {
    payload,
    expiresAt: now + SITE_SETTINGS_CACHE_MS,
  };
  res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
  return res.json(payload);
});

app.get("/api/deploy-status", (_req, res) => {
  const now = Date.now();
  if (cachedDeployStatusPayload && now < cachedDeployStatusPayload.expiresAt) {
    res.setHeader("Cache-Control", "public, max-age=3, stale-while-revalidate=20");
    return res.json(cachedDeployStatusPayload.payload);
  }

  const payload = { success: true, status: readDeployStatus() };
  cachedDeployStatusPayload = {
    payload,
    expiresAt: now + DEPLOY_STATUS_CACHE_MS,
  };
  res.setHeader("Cache-Control", "public, max-age=3, stale-while-revalidate=20");
  return res.json(payload);
});

app.put("/api/site-settings", requireAuth, requireAdmin, (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ success: false, message: "Invalid settings payload." });
  }

  const current = readSettings();
  const next = { ...current, ...req.body };

  const normalizeCount = (value, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return fallback;
    return Math.floor(numeric);
  };

  next.maintenanceMode = Boolean(next.maintenanceMode);
  next.maintenanceMessage = String(next.maintenanceMessage || defaultSiteSettings.maintenanceMessage).trim() || defaultSiteSettings.maintenanceMessage;
  next.launchDate = String(next.launchDate || defaultSiteSettings.launchDate).trim();
  next.announcement = String(next.announcement || "").trim();
  next.teamApplicationsOpen = Boolean(next.teamApplicationsOpen);
  next.applicationsOpen = Boolean(next.applicationsOpen);
  next.conferenceDate = String(next.conferenceDate || defaultSiteSettings.conferenceDate).trim();
  next.locationText = String(next.locationText || defaultSiteSettings.locationText).trim() || defaultSiteSettings.locationText;
  next.conferenceDescription = String(next.conferenceDescription || defaultSiteSettings.conferenceDescription).trim() || defaultSiteSettings.conferenceDescription;
  next.countdownEnabled = Boolean(next.countdownEnabled);
  next.instagramStatsSource = String(next.instagramStatsSource || "live").trim().toLowerCase() === "manual" ? "manual" : "live";
  next.instagramFollowers = normalizeCount(next.instagramFollowers, defaultSiteSettings.instagramFollowers);
  next.instagramPosts = normalizeCount(next.instagramPosts, defaultSiteSettings.instagramPosts);
  next.instagramFollowing = normalizeCount(next.instagramFollowing, defaultSiteSettings.instagramFollowing);

  writeSettings(next);
  cachedSiteSettingsPayload = null;
  cachedDeployStatusPayload = null;
  cachedInstagramPayload = null;
  return res.json({ success: true, message: "Site settings updated.", settings: next });
});

app.get("/api/waitlist", (_req, res) => {
  res.json({ success: true, entries: readWaitlist(), deletedEntries: readDeletedWaitlist() });
});

app.post("/api/waitlist", waitlistWriteRateLimit, (req, res) => {
  const action = String(req.body && req.body.action ? req.body.action : "create").trim();
  const reviewedBy = String(req.body && req.body.reviewedBy ? req.body.reviewedBy : "").trim();

  const entries = readWaitlist().map(normalizeWaitlistEntry);
  const deletedEntries = readDeletedWaitlist().map(normalizeWaitlistEntry);

  if (action === "updateStatus") {
    const id = String(req.body && req.body.id ? req.body.id : "").trim();
    const status = String(req.body && req.body.status ? req.body.status : "").trim();
    if (!id || !VALID_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: "Invalid status update payload." });
    }

    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: "Entry not found." });
    }

    entries[idx] = { ...entries[idx], status, reviewedBy, reviewedAt: nowIso() };
    writeWaitlist(entries);
    return res.json({ success: true, message: "Status updated.", entries, deletedEntries });
  }

  if (action === "setNotified") {
    const id = String(req.body && req.body.id ? req.body.id : "").trim();
    const notified = Boolean(req.body && req.body.notified);
    if (!id) {
      return res.status(400).json({ success: false, message: "Entry id is required." });
    }

    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: "Entry not found." });
    }

    entries[idx] = {
      ...entries[idx],
      notified,
      notifiedAt: notified ? nowIso() : "",
      reviewedBy,
      reviewedAt: nowIso(),
    };
    writeWaitlist(entries);
    return res.json({ success: true, message: "Notification status updated.", entries, deletedEntries });
  }

  if (action === "notifyAll") {
    const nextEntries = entries.map((entry) => ({
      ...entry,
      notified: true,
      notifiedAt: nowIso(),
      reviewedBy,
      reviewedAt: nowIso(),
    }));
    writeWaitlist(nextEntries);
    return res.json({ success: true, message: "All entries marked as notified.", entries: nextEntries, deletedEntries });
  }

  if (action === "delete") {
    const id = String(req.body && req.body.id ? req.body.id : "").trim();
    if (!id) {
      return res.status(400).json({ success: false, message: "Entry id is required." });
    }

    const removed = entries.find((e) => e.id === id);
    const filtered = entries.filter((e) => e.id !== id);
    if (!removed || filtered.length === entries.length) {
      return res.status(404).json({ success: false, message: "Entry not found." });
    }

    deletedEntries.unshift({ ...removed, deletedAt: nowIso(), deletedBy: reviewedBy });
    writeWaitlist(filtered);
    writeDeletedWaitlist(deletedEntries);
    return res.json({ success: true, message: "Entry deleted.", entries: filtered, deletedEntries });
  }

  if (action === "restore") {
    const id = String(req.body && req.body.id ? req.body.id : "").trim();
    if (!id) {
      return res.status(400).json({ success: false, message: "Deleted entry id is required." });
    }

    const idx = deletedEntries.findIndex((e) => e.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: "Deleted entry not found." });
    }

    const [restored] = deletedEntries.splice(idx, 1);
    entries.unshift({ ...normalizeWaitlistEntry(restored), reviewedAt: nowIso(), reviewedBy });
    writeWaitlist(entries);
    writeDeletedWaitlist(deletedEntries);
    return res.json({ success: true, message: "Entry restored.", entries, deletedEntries });
  }

  if (action !== "create") {
    return res.status(400).json({ success: false, message: "Unsupported action." });
  }

  const name = String(req.body && req.body.name ? req.body.name : "").trim();
  const email = String(req.body && req.body.email ? req.body.email : "").trim().toLowerCase();
  const school = String(req.body && req.body.school ? req.body.school : "").trim();
  const role = String(req.body && req.body.role ? req.body.role : "delegate").trim();

  if (!name || !email || !school || !role) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  if (name.length > 120 || school.length > 160 || role.length > 40) {
    return res.status(400).json({ success: false, message: "One or more fields exceed maximum allowed length." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email format." });
  }

  if (entries.some((e) => normalizeUsername(e.email) === normalizeUsername(email))) {
    return res.status(409).json({ success: false, message: "Email already registered.", entries, deletedEntries });
  }

  if (entries.some((e) => normalizeUsername(e.name) === normalizeUsername(name))) {
    return res.status(409).json({ success: false, message: "Name already registered.", entries, deletedEntries });
  }

  entries.unshift(normalizeWaitlistEntry({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name,
    email,
    school,
    role,
    addedAt: nowIso(),
    status: "pending",
    reviewedAt: "",
    reviewedBy: "",
    notified: false,
    notifiedAt: "",
  }));

  writeWaitlist(entries);
  return res.json({ success: true, message: "Added to waitlist.", entries, deletedEntries });
});

app.get("/api/questions", requireAuth, requireAdmin, (_req, res) => {
  const entries = readQuestions().map(normalizeQuestionEntry);
  return res.json({ success: true, entries });
});

app.post("/api/questions", questionWriteRateLimit, (req, res) => {
  const name = String(req.body && req.body.name ? req.body.name : "").trim();
  const email = String(req.body && req.body.email ? req.body.email : "").trim().toLowerCase();
  const question = normalizeQuestionText(req.body && req.body.question ? req.body.question : "");
  const sourcePath = String(req.body && req.body.path ? req.body.path : "/").trim() || "/";
  const isAnonymous = Boolean(req.body && req.body.isAnonymous);
  const honeypot = String(req.body && req.body.website ? req.body.website : "").trim();

  if (honeypot) {
    return res.status(400).json({ success: false, message: "Submission rejected." });
  }

  if (!question) {
    return res.status(400).json({ success: false, message: "Please enter your question." });
  }

  if (question.length < 12 || question.length > 1500) {
    return res.status(400).json({ success: false, message: "Questions must be between 12 and 1500 characters." });
  }

  if (name.length > 80 || email.length > 160) {
    return res.status(400).json({ success: false, message: "One or more fields exceed the allowed length." });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  if (looksLikeQuestionSpam(question)) {
    return res.status(400).json({ success: false, message: "Please remove links or repeated spam text and try again." });
  }

  const ip = getRequestIp(req);
  const userAgent = String(req.headers && req.headers["user-agent"] ? req.headers["user-agent"] : "Unknown");
  const entries = readQuestions().map(normalizeQuestionEntry);
  const now = Date.now();
  const fingerprint = getQuestionFingerprint(question);

  const recentFromSameIp = entries.find((entry) => {
    const createdAtMs = new Date(String(entry.createdAt || "")).getTime();
    return entry.ip === ip && Number.isFinite(createdAtMs) && now - createdAtMs < QUESTION_COOLDOWN_MS;
  });

  if (recentFromSameIp) {
    return res.status(429).json({
      success: false,
      message: "Please wait a little before sending another question.",
      retryAfterSeconds: Math.max(1, Math.ceil((QUESTION_COOLDOWN_MS - (now - new Date(recentFromSameIp.createdAt).getTime())) / 1000)),
    });
  }

  const duplicate = entries.find((entry) => {
    const createdAtMs = new Date(String(entry.createdAt || "")).getTime();
    return entry.ip === ip
      && getQuestionFingerprint(entry.question) === fingerprint
      && Number.isFinite(createdAtMs)
      && now - createdAtMs < QUESTION_DUPLICATE_WINDOW_MS;
  });

  if (duplicate) {
    return res.status(409).json({ success: false, message: "That question was already submitted recently." });
  }

  const nextEntry = normalizeQuestionEntry({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name: isAnonymous ? "" : name,
    email: isAnonymous ? "" : email,
    question,
    isAnonymous: isAnonymous || (!name && !email),
    status: "new",
    replyText: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    repliedAt: "",
    repliedBy: "",
    sourcePath,
    ip,
    userAgent,
  });

  entries.unshift(nextEntry);
  writeQuestions(entries);
  return res.json({ success: true, message: "Question received.", entry: nextEntry });
});

app.patch("/api/questions/:id", requireAuth, requireAdmin, (req, res) => {
  const id = String(req.params && req.params.id ? req.params.id : "").trim();
  if (!id) {
    return res.status(400).json({ success: false, message: "Question id is required." });
  }

  const entries = readQuestions().map(normalizeQuestionEntry);
  const idx = entries.findIndex((entry) => entry.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Question not found." });
  }

  const nextStatusRaw = String(req.body && req.body.status ? req.body.status : "").trim().toLowerCase();
  const hasReplyText = Object.prototype.hasOwnProperty.call(req.body || {}, "replyText");
  const nextReplyText = hasReplyText ? normalizeQuestionText(req.body && req.body.replyText ? req.body.replyText : "") : null;

  if (nextStatusRaw && !VALID_QUESTION_STATUSES.has(nextStatusRaw)) {
    return res.status(400).json({ success: false, message: "Invalid question status." });
  }

  if (hasReplyText && nextReplyText && nextReplyText.length > 1200) {
    return res.status(400).json({ success: false, message: "Replies must stay under 1200 characters." });
  }

  const currentEntry = entries[idx];
  const nextEntry = {
    ...currentEntry,
    updatedAt: nowIso(),
  };

  if (nextStatusRaw) {
    nextEntry.status = nextStatusRaw;
  }

  if (hasReplyText) {
    nextEntry.replyText = nextReplyText || "";
    nextEntry.repliedAt = nextReplyText ? nowIso() : "";
    nextEntry.repliedBy = nextReplyText ? String(req.auth.user.username || "").trim() : "";
    if (nextReplyText && !nextStatusRaw) {
      nextEntry.status = "replied";
    }
  }

  entries[idx] = normalizeQuestionEntry(nextEntry);
  writeQuestions(entries);
  return res.json({ success: true, message: "Question updated.", entries });
});

app.get("/api/analytics", (req, res) => {
  const logs = readAnalytics();
  res.json({ success: true, logs });
});

app.post("/api/analytics", publicWriteRateLimit, (req, res) => {
  const action = String(req.body && req.body.action ? req.body.action : "track").trim();
  if (action !== "track") {
    return res.status(400).json({ success: false, message: "Unsupported action." });
  }

  const entry = req.body && req.body.entry && typeof req.body.entry === "object" ? req.body.entry : {};
  const ip = getRequestIp(req);
  const inferredGeo = inferGeoFromIp(ip);
  const countryInput = String(entry.country || "").trim();
  const countryCodeInput = String(entry.countryCode || "").trim().toUpperCase();
  const normalized = {
    timestamp: String(entry.timestamp || nowIso()),
    path: String(entry.path || "index.html").substring(0, 200),
    ip,
    country: String(countryInput || inferredGeo.country).substring(0, 80),
    countryCode: String(countryCodeInput || inferredGeo.countryCode).substring(0, 4),
    flag: String(entry.flag || toCountryFlag(countryCodeInput) || inferredGeo.flag).substring(0, 8),
    device: String(entry.device || "Unknown").substring(0, 64),
    userAgent: String(entry.userAgent || "Unknown").substring(0, 256),
  };

  const logs = readAnalytics();
  logs.unshift(normalized);
  writeAnalytics(logs);

  res.json({ success: true, message: "Tracked.", total: logs.length });
});

app.get("/api/instagram", async (req, res) => {
  const username = String(req.query && req.query.username ? req.query.username : "theenchantedsummit").trim().replace(/^@+/, "").toLowerCase();
  const settings = readSettings();
  const now = Date.now();

  if (cachedInstagramPayload && cachedInstagramPayload.username === username && now < cachedInstagramPayload.expiresAt) {
    res.setHeader("Cache-Control", "public, max-age=20, stale-while-revalidate=60");
    return res.json(cachedInstagramPayload.payload);
  }

  try {
    if (settings.instagramStatsSource === "manual") {
      const manualPayload = {
        success: true,
        stale: false,
        source: "manual",
        followers: Number(settings.instagramFollowers) || defaultSiteSettings.instagramFollowers,
        posts: Number(settings.instagramPosts) || defaultSiteSettings.instagramPosts,
        following: Number(settings.instagramFollowing) || defaultSiteSettings.instagramFollowing,
        username,
        profileUrl: `https://www.instagram.com/${username}/`,
        fetchedAt: nowIso(),
      };
      cachedInstagramPayload = {
        username,
        payload: manualPayload,
        expiresAt: now + INSTAGRAM_CACHE_MS,
      };
      res.setHeader("Cache-Control", "public, max-age=20, stale-while-revalidate=60");
      return res.json(manualPayload);
    }

    const stats = await getInstagramLiveStats(username);
    const livePayload = {
      success: true,
      ...stats,
      username,
      profileUrl: `https://www.instagram.com/${username}/`,
      fetchedAt: nowIso(),
    };
    cachedInstagramPayload = {
      username,
      payload: livePayload,
      expiresAt: now + INSTAGRAM_CACHE_MS,
    };
    res.setHeader("Cache-Control", "public, max-age=20, stale-while-revalidate=60");
    return res.json(livePayload);
  } catch (error) {
    const fallbackPayload = {
      success: false,
      message: "Server error while fetching Instagram stats.",
      error: String(error && error.message ? error.message : error),
      followers: Number(settings.instagramFollowers) || defaultSiteSettings.instagramFollowers,
      posts: Number(settings.instagramPosts) || defaultSiteSettings.instagramPosts,
      following: Number(settings.instagramFollowing) || defaultSiteSettings.instagramFollowing,
      stale: true,
      source: "error_fallback",
      username,
      profileUrl: `https://www.instagram.com/${username}/`,
      fetchedAt: nowIso(),
    };
    cachedInstagramPayload = {
      username,
      payload: fallbackPayload,
      expiresAt: now + Math.min(INSTAGRAM_CACHE_MS, 20 * 1000),
    };
    return res.status(500).json(fallbackPayload);
  }
});

const requireAccessGate = (req, res, next) => {
  const activeSession = getSession(req);
  if (activeSession) {
    setAccessGateCookie(res);
    return next();
  }

  const token = req.cookies && req.cookies[ACCESS_GATE_COOKIE];
  if (!verifySignedToken(token)) {
    clearAccessGateCookie(res);
    return res.redirect(302, "/access");
  }
  return next();
};

Object.entries(LEGACY_PAGE_REDIRECTS).forEach(([legacyPath, cleanPath]) => {
  app.get(legacyPath, (_req, res) => {
    res.redirect(301, cleanPath);
  });
});

Object.entries(PAGE_ROUTE_FILES).forEach(([routePath, fileName]) => {
  if (routePath === "/access") {
    app.get(routePath, (req, res) => {
      if (getSession(req)) {
        return res.redirect(302, "/dashboard");
      }
      return res.sendFile(path.join(__dirname, "..", fileName));
    });
    return;
  }

  if (routePath === "/portal") {
    app.get(routePath, requireAccessGate, (_req, res) => {
      res.sendFile(path.join(__dirname, "..", fileName));
    });
    return;
  }

  app.get(routePath, (_req, res) => {
    res.sendFile(path.join(__dirname, "..", fileName));
  });
});

app.use(express.static(path.join(__dirname, ".."), {
  setHeaders: (res, filePath) => {
    const lower = String(filePath || "").toLowerCase();

    if (lower.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return;
    }

    if (lower.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader("Cache-Control", `public, max-age=${STATIC_LONG_CACHE_SECONDS}, stale-while-revalidate=86400`);
      return;
    }

    res.setHeader("Cache-Control", `public, max-age=${STATIC_SHORT_CACHE_SECONDS}, stale-while-revalidate=3600`);
  },
}));

app.get("*", (req, res) => {
  if (String(req.path || "").startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "API route not found." });
  }
  return res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Enchanted Summit server running on http://localhost:${PORT}`);
});
