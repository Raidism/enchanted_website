const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const { readJson, writeJson } = require("./store");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const SESSION_COOKIE = "imperium_sid";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const defaultSiteSettings = {
  maintenanceMode: false,
  maintenanceMessage: "Imperium MUN is temporarily under maintenance. Please check back soon.",
  launchDate: "2026-03-28T00:00:00+03:00",
  announcement: "",
  applicationsOpen: false,
  conferenceDate: "2026-05-15T09:00:00+03:00",
  locationText: "Riyadh, Saudi Arabia",
  conferenceDescription: "Imperium MUN is a student-led conference focused on collaboration, critical thinking, and impactful debate.",
  countdownEnabled: true,
  instagramStatsSource: "live",
  instagramFollowers: 487,
  instagramPosts: 18,
  instagramFollowing: 4,
};

const DEFAULT_USERS = [
  { username: "admin", password: "Soliman123@", role: "admin", name: "Adham Soliman", photo: "assets/adham pic.jpg" },
  { username: "everyone", password: "123", role: "member", name: "", photo: "" },
  { username: "ln-obidat", password: "3004", role: "admin", name: "Leen Obeidat", photo: "assets/under secretary general.png" },
  { username: "AhmadPh", password: "Ahmadggg", role: "admin", name: "Ahmed Pharaon", photo: "assets/secretary general.png" },
  { username: "Toleenkmedia", password: "Totakordi10", role: "member", name: "Toleen Kurdi", photo: "assets/head of media.png" },
  { username: "OmarAlhomran", password: "0987654321", role: "member", name: "Omar Alhomran", photo: "assets/Head of DA.png" },
  { username: "Yamendalegend", password: "YamenloveAdham", role: "member", name: "YAMEN ELATTAL", photo: "assets/HEAD OF CA.png" },
];

const nowIso = () => new Date().toISOString();
const normalizeUsername = (v) => String(v || "").trim().toLowerCase();

const readUsers = () => readJson("users", []);
const writeUsers = (users) => writeJson("users", users);
const readSessions = () => readJson("sessions", {});
const writeSessions = (sessions) => writeJson("sessions", sessions);
const readHistory = () => readJson("login_history", []);
const writeHistory = (history) => writeJson("login_history", history);
const readSettings = () => ({ ...defaultSiteSettings, ...readJson("site_settings", {}) });
const writeSettings = (settings) => writeJson("site_settings", { ...defaultSiteSettings, ...settings });
const readWaitlist = () => readJson("waitlist_entries", []);
const writeWaitlist = (rows) => writeJson("waitlist_entries", rows.slice(0, 3000));
const readDeletedWaitlist = () => readJson("waitlist_deleted", []);
const writeDeletedWaitlist = (rows) => writeJson("waitlist_deleted", rows.slice(0, 500));
const readAnalytics = () => readJson("analytics_logs", []);
const writeAnalytics = (rows) => writeJson("analytics_logs", rows.slice(0, 2000));

const ensureSeedData = () => {
  const users = readUsers();
  if (!Array.isArray(users) || users.length === 0) {
    const seeded = DEFAULT_USERS.map((u) => ({
      ...u,
      passwordHash: bcrypt.hashSync(String(u.password), 10),
      disabled: false,
    }));
    writeUsers(seeded);
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

  if (!Array.isArray(readAnalytics())) {
    writeAnalytics([]);
  }
};

const sanitizeUser = (user) => ({
  username: user.username,
  role: user.role || "member",
  disabled: Boolean(user.disabled),
  name: String(user.name || ""),
  photo: String(user.photo || ""),
});

const sanitizeUserForAdmin = (user) => ({
  username: user.username,
  password: String(user.password || ""),
  role: user.role || "member",
  disabled: Boolean(user.disabled),
  name: String(user.name || ""),
  photo: String(user.photo || ""),
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

const VALID_STATUSES = new Set(["pending", "green", "red", "saved"]);

const readCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric);
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

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "ok", time: nowIso() });
});

app.post("/api/auth/login", (req, res) => {
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

app.get("/api/site-settings", (_req, res) => {
  res.json({ success: true, settings: readSettings() });
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
  return res.json({ success: true, message: "Site settings updated.", settings: next });
});

app.get("/api/waitlist", (_req, res) => {
  res.json({ success: true, entries: readWaitlist(), deletedEntries: readDeletedWaitlist() });
});

app.post("/api/waitlist", (req, res) => {
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

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email format." });
  }

  if (entries.some((e) => normalizeUsername(e.email) === normalizeUsername(email))) {
    return res.status(409).json({ success: false, message: "Email already registered.", entries, deletedEntries });
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

app.get("/api/analytics", (req, res) => {
  const logs = readAnalytics();
  res.json({ success: true, logs });
});

app.post("/api/analytics", (req, res) => {
  const action = String(req.body && req.body.action ? req.body.action : "track").trim();
  if (action !== "track") {
    return res.status(400).json({ success: false, message: "Unsupported action." });
  }

  const entry = req.body && req.body.entry && typeof req.body.entry === "object" ? req.body.entry : {};
  const normalized = {
    timestamp: String(entry.timestamp || nowIso()),
    path: String(entry.path || "index.html"),
    ip: getClientIpFromHeaders(req.headers),
    country: String(entry.country || "Unknown"),
    countryCode: String(entry.countryCode || "--"),
    flag: String(entry.flag || "🌐"),
    device: String(entry.device || "Unknown"),
    userAgent: String(entry.userAgent || "Unknown"),
  };

  const logs = readAnalytics();
  logs.unshift(normalized);
  writeAnalytics(logs);

  res.json({ success: true, message: "Tracked.", total: logs.length });
});

app.get("/api/instagram", async (req, res) => {
  const username = String(req.query && req.query.username ? req.query.username : "imperiummun26").trim().replace(/^@+/, "").toLowerCase();
  const settings = readSettings();

  try {
    if (settings.instagramStatsSource === "manual") {
      return res.json({
        success: true,
        stale: false,
        source: "manual",
        followers: Number(settings.instagramFollowers) || defaultSiteSettings.instagramFollowers,
        posts: Number(settings.instagramPosts) || defaultSiteSettings.instagramPosts,
        following: Number(settings.instagramFollowing) || defaultSiteSettings.instagramFollowing,
        username,
        profileUrl: `https://www.instagram.com/${username}/`,
        fetchedAt: nowIso(),
      });
    }

    const stats = await getInstagramLiveStats(username);
    return res.json({
      success: true,
      ...stats,
      username,
      profileUrl: `https://www.instagram.com/${username}/`,
      fetchedAt: nowIso(),
    });
  } catch (error) {
    return res.status(500).json({
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
    });
  }
});

app.use(express.static(path.join(__dirname, "..")));

app.get("*", (req, res) => {
  if (String(req.path || "").startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "API route not found." });
  }
  return res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Imperium server running on http://localhost:${PORT}`);
});
