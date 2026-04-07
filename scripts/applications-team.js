const currentUser = window.EnchantedAuth.getCurrentUser();
if (!currentUser) {
  window.location.href = "/access";
  throw new Error("No active session");
}

const escapeHtml = (str) => {
  const s = String(str ?? "");
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const effectiveType = String(connection && connection.effectiveType ? connection.effectiveType : "").toLowerCase();
const constrainedNetwork = Boolean(connection && connection.saveData) || /(^|[^a-z])2g|3g([^a-z]|$)/.test(effectiveType);
if (prefersReducedMotion || constrainedNetwork) {
  document.body.classList.add("lite-motion");
}

const API_BASE = String((window.EnchantedRuntime && window.EnchantedRuntime.apiBase) || "/api").replace(/\/+$/, "");

window.EnchantedAuth.heartbeat();
setInterval(() => window.EnchantedAuth.heartbeat(), 30000);

const _appProfileKey = String(currentUser.username || "").trim().toLowerCase();
const _appRoleLabels = {
  admin: "Head of IT",
  "ln-obidat": "Under Secretary General",
  ahmadph: "Secretary General",
  toleenkmedia: "Head of Media",
  joumohd08: "Head of HR",
  y72n_e: "Head of HR",
};
const _APP_PROFILE_FALLBACKS = {
  admin: {
    name: "Adham / Head of IT",
    photo: "/assets/enchanted logo.jpg",
  },
  joumohd08: {
    name: "Joumana Mohamed",
    photo: "/assets/enchanted logo.jpg",
  },
  y72n_e: {
    name: "Yassin elnaggar",
    photo: "/assets/enchanted logo.jpg",
  },
};
const _appProfileFallback = _APP_PROFILE_FALLBACKS[_appProfileKey] || {};
const _appDisplayName = String(_appProfileFallback.name || currentUser.name || currentUser.username || "User");
const normalizeAssetPath = (value, fallback) => {
  const candidate = String(value || fallback || "").trim();
  if (!candidate) return String(fallback || "");
  if (/^(https?:)?\/\//i.test(candidate) || candidate.startsWith("data:") || candidate.startsWith("/")) {
    return candidate;
  }
  return `/${candidate.replace(/^\/+/, "")}`;
};

const _appProfilePhoto = normalizeAssetPath(
  _appProfileFallback.photo || currentUser.photo,
  "/assets/enchanted logo.jpg",
);
const _appRoleLabel = _appRoleLabels[_appProfileKey] || (currentUser.role === "admin" ? "Admin" : "Member");

const _aPmhPhoto = document.getElementById("pmhPhoto");
const _aPmhName = document.getElementById("pmhName");
const _aPmhRole = document.getElementById("pmhRole");
const _aPmhHero = document.getElementById("pageMiniHero");
if (_aPmhPhoto) {
  _aPmhPhoto.src = _appProfilePhoto;
  _aPmhPhoto.alt = "";
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
const teamMediaTrend = document.getElementById("teamMediaTrend");
const teamSecurityTrend = document.getElementById("teamSecurityTrend");
const teamVolunteerTrend = document.getElementById("teamVolunteerTrend");
const teamTotalClicks = document.getElementById("teamTotalClicks");
const teamUniqueIps = document.getElementById("teamUniqueIps");
const teamTrendEmpty = document.getElementById("teamTrendEmpty");
const teamTrendChart = document.getElementById("teamTrendChart");
const deviceBreakdownList = document.getElementById("deviceBreakdownList");
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
    if (teamTrendEmpty) teamTrendEmpty.style.display = "block";
    return;
  }

  if (teamTrendEmpty) teamTrendEmpty.style.display = "none";

  const width = 1100;
  const height = 380;
  const padLeft = 70;
  const padRight = 50;
  const padTop = 40;
  const padBottom = 60;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

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
    const x = padLeft + (idx / Math.max(1, orderedDays.length - 1)) * chartW;
    Object.keys(pointsBySeries).forEach((series) => {
      const raw = Number(row[series] || 0);
      const y = padTop + chartH - (raw / maxVal) * chartH;
      pointsBySeries[series].push({ x, y, value: raw, day: asShortDate(day) });
    });
  });

  const colors = {
    media: "#4fd1c5",
    security: "#f6ad55",
    volunteer: "#9f7aea",
    total: "#d5b465",
  };

  const polyline = (series, strokeWidth = 2.5) => {
    const coords = pointsBySeries[series].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return `<polyline points="${coords}" fill="none" stroke="${colors[series]}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"></polyline>`;
  };

  const dots = (series, radius = 2.5) => 
    pointsBySeries[series].map((p, idx) => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${radius}" fill="${colors[series]}" opacity="0.8"></circle>
  `).join("");

  const labels = pointsBySeries.total.map((p, idx) => {
    if (orderedDays.length > 7 && idx % Math.ceil(orderedDays.length / 7) !== 0) return "";
    return `<text x="${p.x.toFixed(1)}" y="${(padTop + chartH + 20)}" text-anchor="middle" font-size="11" fill="#9eb0a3">${p.day}</text>`;
  }).join("");

  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (i / 4) * chartH;
    gridLines.push(`<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="rgba(213,180,101,0.1)" stroke-width="1" stroke-dasharray="2,2"></line>`);
  }

  teamTrendChart.innerHTML = `
    <defs>
      <linearGradient id="chartGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#4fd1c5;stop-opacity:0.15" />
        <stop offset="100%" style="stop-color:#4fd1c5;stop-opacity:0" />
      </linearGradient>
      <linearGradient id="chartGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#f6ad55;stop-opacity:0.15" />
        <stop offset="100%" style="stop-color:#f6ad55;stop-opacity:0" />
      </linearGradient>
      <linearGradient id="chartGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#9f7aea;stop-opacity:0.15" />
        <stop offset="100%" style="stop-color:#9f7aea;stop-opacity:0" />
      </linearGradient>
    </defs>
    ${gridLines.join("")}
    <line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" stroke="rgba(213,180,101,0.3)" stroke-width="1.5"></line>
    ${polyline("total", 3)}
    ${polyline("media", 2.2)}
    ${polyline("security", 2.2)}
    ${polyline("volunteer", 2.2)}
    ${dots("total", 3.2)}
    ${dots("media", 2.4)}
    ${dots("security", 2.4)}
    ${dots("volunteer", 2.4)}
    ${labels}
  `;

  // Render legend separately as HTML
  const chartLegendContainer = document.getElementById("chartLegend");
  if (chartLegendContainer) {
    chartLegendContainer.innerHTML = `
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-dot" style="background-color: ${colors.total}"></span>
          <span class="legend-label">Total</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background-color: ${colors.media}"></span>
          <span class="legend-label">Media</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background-color: ${colors.security}"></span>
          <span class="legend-label">Security</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background-color: ${colors.volunteer}"></span>
          <span class="legend-label">Volunteer</span>
        </div>
      </div>
    `;
  }
};

const renderDashboard = async () => {
  let settings = {};
  try {
    settings = await fetchSiteSettings();
  } catch {
    settings = window.EnchantedAuth.getSiteSettings() || {};
  }

  const isOpen = Boolean(settings.teamApplicationsOpen);
  if (teamApplicationsNotice) {
    const statusContent = isOpen
      ? "Team Applications are currently OPEN for recruiting."
      : "Team Applications are currently CLOSED.";
    teamApplicationsNotice.innerHTML = `<span class="status-dot"></span><span>${statusContent}</span>`;
    teamApplicationsNotice.classList.remove("loading", "success", "error");
    teamApplicationsNotice.classList.add(isOpen ? "success" : "error");
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

  // Calculate trends (comparing recent 7 days to previous 7 days)
  const orderedDayEntries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  const calculateTrend = (team) => {
    if (orderedDayEntries.length < 14) return 0;
    const recent7 = orderedDayEntries.slice(-7).reduce((sum, [, row]) => sum + (row[team] || 0), 0);
    const previous7 = orderedDayEntries.slice(-14, -7).reduce((sum, [, row]) => sum + (row[team] || 0), 0);
    if (previous7 === 0) return recent7 > 0 ? 100 : 0;
    return Math.round(((recent7 - previous7) / previous7) * 100);
  };

  const trendMedia = calculateTrend("media");
  const trendSecurity = calculateTrend("security");
  const trendVolunteer = calculateTrend("volunteer");

  // Update counts
  if (teamMediaCount) teamMediaCount.textContent = String(countByTeam.media);
  if (teamSecurityCount) teamSecurityCount.textContent = String(countByTeam.security);
  if (teamVolunteerCount) teamVolunteerCount.textContent = String(countByTeam.volunteer);

  // Update trends
  const formatTrend = (value) => {
    if (value > 0) return `↑ +${value}%`;
    if (value < 0) return `↓ ${value}%`;
    return "→ 0%";
  };

  const applyTrend = (el, value) => {
    if (!el) return;
    el.textContent = formatTrend(value);
    el.classList.remove("tac-trend--down", "tac-trend--neutral");
    if (value < 0) el.classList.add("tac-trend--down");
    else if (value === 0) el.classList.add("tac-trend--neutral");
  };
  applyTrend(teamMediaTrend, trendMedia);
  applyTrend(teamSecurityTrend, trendSecurity);
  applyTrend(teamVolunteerTrend, trendVolunteer);

  const total = countByTeam.media + countByTeam.security + countByTeam.volunteer;
  if (teamTotalClicks) teamTotalClicks.textContent = String(total);
  if (teamUniqueIps) teamUniqueIps.textContent = String(ipSet.size);

  // Render device breakdown
  if (deviceBreakdownList) {
    if (Object.keys(deviceMap).length === 0) {
      deviceBreakdownList.innerHTML = '<p class="no-data-message">No device data available.</p>';
    } else {
      const topDevices = Object.entries(deviceMap).sort((a, b) => b[1] - a[1]);
      let deviceHTML = "";
      topDevices.forEach(([device, count]) => {
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        deviceHTML += `
          <div class="device-item">
            <div style="flex:1;min-width:0">
              <span class="device-name">${escapeHtml(device)}</span>
              <div class="device-bar-container">
                <div class="device-bar" style="width:${percentage}%"></div>
              </div>
            </div>
            <span class="device-count">${count}</span>
          </div>
        `;
      });
      deviceBreakdownList.innerHTML = deviceHTML;
    }
  }

  const orderedDays = orderedDayEntries.slice(-14);
  renderTrend(orderedDays);
};

renderDashboard();

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    logoutBtn.classList.add("is-loading");
    logoutBtn.disabled = true;
    window.EnchantedAuth.logout();
    window.location.href = "/";
  });
}
