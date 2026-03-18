const currentUser = window.ImperiumAuth.getCurrentUser();
if (!currentUser) {
  window.location.href = "/access";
  throw new Error("No active session");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const effectiveType = String(connection && connection.effectiveType ? connection.effectiveType : "").toLowerCase();
const constrainedNetwork = Boolean(connection && connection.saveData) || /(^|[^a-z])2g|3g([^a-z]|$)/.test(effectiveType);
if (prefersReducedMotion || constrainedNetwork) {
  document.body.classList.add("lite-motion");
}

const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");

window.ImperiumAuth.heartbeat();
setInterval(() => window.ImperiumAuth.heartbeat(), 30000);

const _appProfileKey = String(currentUser.username || "").trim().toLowerCase();
const _appRoleLabels = {
  admin: "Head of IT",
  "ln-obidat": "Under Secretary General",
  ahmadph: "Secretary General",
  toleenkmedia: "Head of Media",
  joumohd08: "Head of HR",
};
const _APP_PROFILE_FALLBACKS = {
  joumohd08: {
    name: "Joumana Mohamed",
    photo: "assets/Joumana Mohamed .png",
  },
};
const _appProfileFallback = _APP_PROFILE_FALLBACKS[_appProfileKey] || {};
const _appDisplayName = String(_appProfileFallback.name || currentUser.name || currentUser.username || "User");
const _appProfilePhoto = String(_appProfileFallback.photo || currentUser.photo || "assets/imperium mun logo.jpg");
const _appRoleLabel = _appRoleLabels[_appProfileKey] || (currentUser.role === "admin" ? "Admin" : "Member");

const _aPmhPhoto = document.getElementById("pmhPhoto");
const _aPmhName = document.getElementById("pmhName");
const _aPmhRole = document.getElementById("pmhRole");
const _aPmhHero = document.getElementById("pageMiniHero");
if (_aPmhPhoto) {
  _aPmhPhoto.src = _appProfilePhoto;
  _aPmhPhoto.alt = _appDisplayName;
}
if (_aPmhName) _aPmhName.textContent = _appDisplayName;
if (_aPmhRole) _aPmhRole.textContent = _appRoleLabel;
if (_aPmhHero) {
  _aPmhHero.classList.remove("profile-pending");
  _aPmhHero.classList.add("profile-ready");
}

if (currentUser.role !== "admin") {
  const adminLinks = document.querySelectorAll("[data-admin-link]");
  adminLinks.forEach((link) => {
    link.classList.add("locked-link");
    link.setAttribute("aria-disabled", "true");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const href = String(link.getAttribute("href") || "").toLowerCase();
      const feature = href.includes("ops") ? "ops" : (href.includes("settings") ? "settings" : "restricted");
      window.location.href = `/locked?feature=${encodeURIComponent(feature)}&from=applications-team`;
    });
  });
}

const teamApplicationsNotice = document.getElementById("teamApplicationsNotice");
const teamMediaCount = document.getElementById("teamMediaCount");
const teamSecurityCount = document.getElementById("teamSecurityCount");
const teamVolunteerCount = document.getElementById("teamVolunteerCount");
const teamTotalClicks = document.getElementById("teamTotalClicks");
const teamUniqueIps = document.getElementById("teamUniqueIps");
const teamTopDevice = document.getElementById("teamTopDevice");
const teamTrendEmpty = document.getElementById("teamTrendEmpty");
const teamTrendChart = document.getElementById("teamTrendChart");
const logoutBtn = document.getElementById("logoutBtn");

const fetchSiteSettings = async () => {
  const response = await fetch(`${API_BASE}/site-settings`, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch site settings");
  }
  const payload = await response.json();
  return payload && payload.settings ? payload.settings : {};
};

const fetchClickEvents = async () => {
  const response = await fetch(`${API_BASE}/analytics/clicks`, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load analytics clicks");
  }
  const payload = await response.json();
  return payload && Array.isArray(payload.clicks) ? payload.clicks : [];
};

const asShortDate = (isoDay) => String(isoDay || "").slice(5);

const renderTrend = (orderedDays) => {
  if (!teamTrendChart) return;

  if (!orderedDays.length) {
    teamTrendChart.innerHTML = "";
    if (teamTrendEmpty) teamTrendEmpty.hidden = false;
    return;
  }

  if (teamTrendEmpty) teamTrendEmpty.hidden = true;

  const width = 760;
  const height = 240;
  const left = 46;
  const top = 24;
  const chartW = 680;
  const chartH = 160;
  const bottom = top + chartH;
  const stepX = orderedDays.length > 1 ? chartW / (orderedDays.length - 1) : 0;

  let maxVal = 1;
  orderedDays.forEach(([, row]) => {
    ["media", "security", "volunteer"].forEach((k) => {
      maxVal = Math.max(maxVal, Number(row[k] || 0));
    });
    maxVal = Math.max(maxVal, Number(row.total || 0));
  });

  const pointsBySeries = {
    media: [],
    security: [],
    volunteer: [],
    total: [],
  };

  orderedDays.forEach(([day, row], idx) => {
    const x = left + idx * stepX;
    Object.keys(pointsBySeries).forEach((series) => {
      const raw = Number(row[series] || 0);
      const y = bottom - (raw / maxVal) * chartH;
      pointsBySeries[series].push({ x, y, value: raw, day: asShortDate(day) });
    });
  });

  const colors = {
    media: "#4fd1c5",
    security: "#f6ad55",
    volunteer: "#9f7aea",
    total: "#d5b465",
  };

  const polyline = (series, strokeWidth = 3) => {
    const coords = pointsBySeries[series].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
    return `<polyline points="${coords}" fill="none" stroke="${colors[series]}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
  };

  const dots = (series, radius = 3.4) => pointsBySeries[series].map((p) => `
    <circle cx="${Math.round(p.x)}" cy="${Math.round(p.y)}" r="${radius}" fill="${colors[series]}"></circle>
  `).join("");

  const labels = pointsBySeries.total.map((p) => `
    <text x="${Math.round(p.x)}" y="${bottom + 16}" text-anchor="middle" font-size="10" fill="#9eb0a3">${p.day}</text>
  `).join("");

  teamTrendChart.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="rgba(8,14,10,0.7)"></rect>
    <line x1="${left}" y1="${bottom}" x2="${left + chartW}" y2="${bottom}" stroke="rgba(213,180,101,0.35)" stroke-width="1"></line>
    ${polyline("total", 3.4)}
    ${polyline("media", 2.6)}
    ${polyline("security", 2.6)}
    ${polyline("volunteer", 2.6)}
    ${dots("total", 3.6)}
    ${dots("media", 2.8)}
    ${dots("security", 2.8)}
    ${dots("volunteer", 2.8)}
    ${labels}
    <rect x="${left}" y="${top - 14}" width="280" height="18" rx="9" fill="rgba(5,10,7,0.82)" stroke="rgba(213,180,101,0.3)" stroke-width="1"></rect>
    <circle cx="${left + 10}" cy="${top - 5}" r="4" fill="${colors.total}"></circle>
    <text x="${left + 18}" y="${top - 1}" font-size="10" fill="#e2f0e6">Total</text>
    <circle cx="${left + 70}" cy="${top - 5}" r="4" fill="${colors.media}"></circle>
    <text x="${left + 78}" y="${top - 1}" font-size="10" fill="#e2f0e6">Media</text>
    <circle cx="${left + 126}" cy="${top - 5}" r="4" fill="${colors.security}"></circle>
    <text x="${left + 134}" y="${top - 1}" font-size="10" fill="#e2f0e6">Security</text>
    <circle cx="${left + 196}" cy="${top - 5}" r="4" fill="${colors.volunteer}"></circle>
    <text x="${left + 204}" y="${top - 1}" font-size="10" fill="#e2f0e6">Volunteer</text>
  `;
};

const renderDashboard = async () => {
  let settings = {};
  try {
    settings = await fetchSiteSettings();
  } catch {
    settings = window.ImperiumAuth.getSiteSettings() || {};
  }

  const isOpen = Boolean(settings.teamApplicationsOpen);
  if (teamApplicationsNotice) {
    teamApplicationsNotice.textContent = isOpen
      ? "Team Applications are currently OPEN for recruiting."
      : "Team Applications are currently CLOSED.";
    teamApplicationsNotice.classList.toggle("success", isOpen);
    teamApplicationsNotice.classList.toggle("error", !isOpen);
  }

  let clicks = [];
  try {
    clicks = await fetchClickEvents();
  } catch {
    clicks = [];
  }

  const teamEvents = clicks.filter((entry) => String(entry.event || "") === "team_application_click");

  const countByTeam = { media: 0, security: 0, volunteer: 0 };
  const byDay = {};
  const ipSet = new Set();
  const deviceMap = {};

  teamEvents.forEach((entry) => {
    const team = String(entry.label || "").toLowerCase();
    if (!["media", "security", "volunteer"].includes(team)) return;

    countByTeam[team] += 1;

    const day = new Date(String(entry.timestamp || ""));
    if (!Number.isNaN(day.getTime())) {
      const key = day.toISOString().slice(0, 10);
      if (!byDay[key]) byDay[key] = { media: 0, security: 0, volunteer: 0, total: 0 };
      byDay[key][team] += 1;
      byDay[key].total += 1;
    }

    const ip = String(entry.ip || "").trim();
    if (ip) ipSet.add(ip);

    const device = String(entry.platform || entry.browser || "Unknown").trim();
    deviceMap[device] = (deviceMap[device] || 0) + 1;
  });

  if (teamMediaCount) teamMediaCount.textContent = String(countByTeam.media);
  if (teamSecurityCount) teamSecurityCount.textContent = String(countByTeam.security);
  if (teamVolunteerCount) teamVolunteerCount.textContent = String(countByTeam.volunteer);

  const total = countByTeam.media + countByTeam.security + countByTeam.volunteer;
  if (teamTotalClicks) teamTotalClicks.textContent = String(total);
  if (teamUniqueIps) teamUniqueIps.textContent = String(ipSet.size);

  const topDevice = Object.entries(deviceMap).sort((a, b) => b[1] - a[1])[0];
  if (teamTopDevice) {
    teamTopDevice.textContent = topDevice ? `${topDevice[0]} (${topDevice[1]})` : "Unknown";
  }

  const orderedDays = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14);

  renderTrend(orderedDays);
};

renderDashboard();

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    logoutBtn.classList.add("is-loading");
    logoutBtn.disabled = true;
    window.ImperiumAuth.logout();
    window.location.href = "/";
  });
}
