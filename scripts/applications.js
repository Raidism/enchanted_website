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

const siteSettings = window.ImperiumAuth.getSiteSettings();
if (siteSettings.maintenanceMode && currentUser.role !== "admin") {
  window.location.href = "/maintenance";
  throw new Error("Maintenance mode is active for non-admin users");
}

window.ImperiumAuth.heartbeat();
setInterval(() => window.ImperiumAuth.heartbeat(), 30000);

const _appProfileKey = String(currentUser.username || "").trim().toLowerCase();
const _appRoleLabels = {
  admin:          "Head of IT",
  "ln-obidat":    "Under Secretary General",
  ahmadph:        "Secretary General",
  toleenkmedia:   "Head of Media",
  joumohd08:      "Head of HR",
  y72n_e:         "Head of HR",
};
const _APP_PROFILE_FALLBACKS = {
  joumohd08: {
    name: "Joumana Mohamed",
    photo: "assets/Joumana Mohamed .png",
  },
  y72n_e: {
    name: "Yassin elnaggar",
    photo: "assets/Yassin elnaggar.jpg",
  },
};
const _appProfileFallback = _APP_PROFILE_FALLBACKS[_appProfileKey] || {};
const _appDisplayName = String(_appProfileFallback.name || currentUser.name || currentUser.username || "User");
const _appProfilePhoto = String(_appProfileFallback.photo || currentUser.photo || "assets/imperium mun logo.jpg");
const _appRoleLabel   = _appRoleLabels[_appProfileKey] || (currentUser.role === "admin" ? "Admin" : "Member");

// Populate mini hero
const _aPmhPhoto = document.getElementById("pmhPhoto");
const _aPmhName  = document.getElementById("pmhName");
const _aPmhRole  = document.getElementById("pmhRole");
const _aPmhHero  = document.getElementById("pageMiniHero");
if (_aPmhPhoto) { _aPmhPhoto.src = _appProfilePhoto; _aPmhPhoto.alt = _appDisplayName; }
if (_aPmhName) _aPmhName.textContent = _appDisplayName;
if (_aPmhRole) _aPmhRole.textContent = _appRoleLabel;
if (_aPmhHero) { _aPmhHero.classList.remove("profile-pending"); _aPmhHero.classList.add("profile-ready"); }

const teamAppsStatusNotice = document.getElementById("teamAppsStatusNotice");
const teamAppsBtn = document.getElementById("teamAppsBtn");
const appsAnalyticsStatus = document.getElementById("appsAnalyticsStatus");
const appsMetricTotalClicks = document.getElementById("appsMetricTotalClicks");
const appsMetricUniqueIps = document.getElementById("appsMetricUniqueIps");
const appsMetricTopTeam = document.getElementById("appsMetricTopTeam");
const appsTrendEmpty = document.getElementById("appsTrendEmpty");
const appsTrendChart = document.getElementById("appsTrendChart");

const logoutBtn   = document.getElementById("logoutBtn");
const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");

if (currentUser.role !== "admin") {
  const adminLinks = document.querySelectorAll("[data-admin-link]");
  adminLinks.forEach((link) => {
    link.classList.add("locked-link");
    link.setAttribute("aria-disabled", "true");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const href = String(link.getAttribute("href") || "").toLowerCase();
      const feature = href.includes("ops") ? "ops" : (href.includes("settings") ? "settings" : "restricted");
      window.location.href = `/locked?feature=${encodeURIComponent(feature)}&from=applications`;
    });
  });
}

const applyTeamStatus = (settings) => {
  const isOpen = Boolean(settings && settings.teamApplicationsOpen);
  if (teamAppsStatusNotice) {
    teamAppsStatusNotice.textContent = `Team Applications: ${isOpen ? "Open Recruiting" : "Closed"}`;
    teamAppsStatusNotice.classList.toggle("success", isOpen);
    teamAppsStatusNotice.classList.toggle("error", !isOpen);
  }

  if (teamAppsBtn) {
    teamAppsBtn.classList.toggle("is-open", isOpen);
    teamAppsBtn.classList.toggle("is-closed", !isOpen);
  }
};

const toShortDay = (isoDay) => String(isoDay || "").slice(5);

const renderAppsTrend = (orderedDays) => {
  if (!appsTrendChart) return;

  if (!orderedDays.length) {
    appsTrendChart.innerHTML = "";
    if (appsTrendEmpty) appsTrendEmpty.hidden = false;
    return;
  }

  if (appsTrendEmpty) appsTrendEmpty.hidden = true;

  const width = 760;
  const height = 240;
  const left = 44;
  const top = 22;
  const chartW = 688;
  const chartH = 162;
  const bottom = top + chartH;
  const stepX = orderedDays.length > 1 ? chartW / (orderedDays.length - 1) : 0;

  let maxVal = 1;
  orderedDays.forEach(([, row]) => {
    maxVal = Math.max(maxVal, Number(row.total || 0));
  });

  const points = orderedDays.map(([day, row], idx) => {
    const x = left + (idx * stepX);
    const value = Number(row.total || 0);
    const y = bottom - ((value / maxVal) * chartH);
    return { x, y, value, day: toShortDay(day) };
  });

  const linePoints = points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
  const labels = points.map((p) => `
    <text x="${Math.round(p.x)}" y="${bottom + 16}" text-anchor="middle" font-size="10" fill="#9eb0a3">${p.day}</text>
  `).join("");
  const dots = points.map((p) => `
    <circle cx="${Math.round(p.x)}" cy="${Math.round(p.y)}" r="3.2" fill="#4fd1c5"></circle>
  `).join("");

  appsTrendChart.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="rgba(8,14,10,0.7)"></rect>
    <line x1="${left}" y1="${bottom}" x2="${left + chartW}" y2="${bottom}" stroke="rgba(213,180,101,0.35)" stroke-width="1"></line>
    <polyline points="${linePoints}" fill="none" stroke="#4fd1c5" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${dots}
    ${labels}
  `;
};

const renderApplicationsAnalytics = async () => {
  if (!appsTrendChart) return;

  try {
    const response = await fetch(`${API_BASE}/analytics/clicks`, { method: "GET", cache: "no-store" });
    if (!response.ok) {
      throw new Error("analytics unavailable");
    }

    const payload = await response.json();
    const clicks = payload && Array.isArray(payload.clicks) ? payload.clicks : [];
    const teamEvents = clicks.filter((entry) => String(entry.event || "") === "team_application_click");

    const byTeam = { volunteer: 0, media: 0, security: 0 };
    const ipSet = new Set();
    const byDay = {};

    teamEvents.forEach((entry) => {
      const label = String(entry.label || "").toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(byTeam, label)) {
        return;
      }

      byTeam[label] += 1;

      const ip = String(entry.ip || "").trim();
      if (ip) ipSet.add(ip);

      const ts = new Date(String(entry.timestamp || ""));
      if (!Number.isNaN(ts.getTime())) {
        const day = ts.toISOString().slice(0, 10);
        if (!byDay[day]) byDay[day] = { total: 0 };
        byDay[day].total += 1;
      }
    });

    const total = byTeam.volunteer + byTeam.media + byTeam.security;
    const topTeam = Object.entries(byTeam).sort((a, b) => b[1] - a[1])[0] || ["none", 0];
    const topTeamLabel = topTeam[1] > 0 ? `${topTeam[0].charAt(0).toUpperCase()}${topTeam[0].slice(1)} (${topTeam[1]})` : "None";

    if (appsMetricTotalClicks) appsMetricTotalClicks.textContent = String(total);
    if (appsMetricUniqueIps) appsMetricUniqueIps.textContent = String(ipSet.size);
    if (appsMetricTopTeam) appsMetricTopTeam.textContent = topTeamLabel;
    if (appsAnalyticsStatus) {
      appsAnalyticsStatus.textContent = total > 0
        ? "Live team-click activity for the last 14 days."
        : "No team click activity yet.";
    }

    const orderedDays = Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14);

    renderAppsTrend(orderedDays);
  } catch {
    if (appsAnalyticsStatus) {
      appsAnalyticsStatus.textContent = "Could not load analytics right now.";
    }
    renderAppsTrend([]);
  }
};

applyTeamStatus(siteSettings);

if (teamAppsBtn) {
  teamAppsBtn.addEventListener("click", () => {
    if (window.ImperiumTracker && typeof window.ImperiumTracker.trackEvent === "function") {
      window.ImperiumTracker.trackEvent("applications_workspace_open", "team");
    }
  });
}

const refreshTeamStatus = async () => {
  try {
    const response = await fetch(`${API_BASE}/site-settings`, { method: "GET", cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload && payload.settings) {
      applyTeamStatus(payload.settings);
    }
  } catch {
    // keep current state when fetch fails
  }
};

window.addEventListener("storage", (event) => {
  if (event.key === "imperium_site_settings") {
    refreshTeamStatus();
  }
});

window.addEventListener("imperium:site-settings-updated", (event) => {
  const settings = event && event.detail ? event.detail.settings : null;
  if (settings) {
    applyTeamStatus(settings);
  }
});

setTimeout(refreshTeamStatus, 220);
setTimeout(renderApplicationsAnalytics, 260);

logoutBtn.addEventListener("click", () => {
  logoutBtn.classList.add("is-loading");
  logoutBtn.disabled = true;

  const photoSrc = currentUser.photo || "assets/imperium mun logo.jpg";
  const overlay  = document.createElement("div");
  overlay.className = "logout-overlay";
  overlay.innerHTML = `
    <div class="logout-card">
      <div class="logout-photo-ring">
        <img src="${photoSrc}" alt="" class="logout-photo" />
      </div>
      <p class="logout-name">${_appDisplayName}</p>
      <p class="logout-msg">Goodbye. See you next time.</p>
      <p class="logout-msg" style="font-size:.8rem;opacity:.4;margin-top:.1rem">Securing session\u2026</p>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-visible"));

  if (typeof gsap !== "undefined") {
    const ring = overlay.querySelector(".logout-photo-ring");
    const card = overlay.querySelector(".logout-card");
    gsap.to(ring, { scale: 1.18, opacity: 0, duration: 0.65, ease: "power2.in", delay: 0.95 });
    gsap.to(card, { y: -24, opacity: 0, duration: 0.48, ease: "power2.in", delay: 1.1 });
    gsap.to(overlay, { opacity: 0, duration: 0.4, ease: "power2.in", delay: 1.45,
      onComplete: () => { window.ImperiumAuth.logout(); window.location.href = "/"; } });
  } else {
    setTimeout(() => { window.ImperiumAuth.logout(); window.location.href = "/"; }, 1600);
  }
});

// GSAP entrance + page transitions
(function initAppGSAP() {
  if (typeof gsap === "undefined") return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const useLiteMotion = prefersReduced || document.body.classList.contains("lite-motion");

  document.body.style.opacity = "0";
  requestAnimationFrame(() => {
    gsap.to(document.body, { opacity: 1, duration: 0.55, ease: "power2.out" });
  });

  if (!useLiteMotion) {
    const header  = document.querySelector(".dash-header");
    const hero    = document.getElementById("pageMiniHero");
    const section = document.querySelector(".dash-main > .section");
    const cards   = document.querySelectorAll(".app-card");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (header)  tl.from(header,  { y: -22, opacity: 0, duration: 0.5 }, 0);
    if (hero)    tl.from(hero,    { y: 34, opacity: 0, scale: 0.97, duration: 0.72, ease: "power4.out" }, 0.1);
    if (section) tl.from(section, { y: 26, opacity: 0, duration: 0.6 }, 0.28);
    if (cards.length) tl.from(cards, { y: 28, opacity: 0, scale: 0.93, stagger: 0.1, duration: 0.58, ease: "back.out(1.7)" }, 0.42);
  }

  document.querySelectorAll(".dash-header a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    link.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      gsap.to(document.body, { opacity: 0, duration: 0.3, ease: "power2.in",
        onComplete: () => { window.location.href = href; } });
    });
  });
})();
