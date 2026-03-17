const currentUser = window.ImperiumAuth.getCurrentUser();
if (!currentUser) {
  window.location.href = "/access";
  throw new Error("No active session");
}

const siteSettings = window.ImperiumAuth.getSiteSettings();
if (siteSettings.maintenanceMode && currentUser.role !== "admin") {
  window.location.href = "/maintenance";
  throw new Error("Maintenance mode is active for non-admin users");
}

const applicationsOpen = Boolean(siteSettings.applicationsOpen);

window.ImperiumAuth.heartbeat();
setInterval(() => window.ImperiumAuth.heartbeat(), 30000);

const _appProfileKey = String(currentUser.username || "").trim().toLowerCase();
const _appRoleLabels = {
  admin:          "Head of IT",
  "ln-obidat":    "Under Secretary General",
  ahmadph:        "Secretary General",
  toleenkmedia:   "Head of Media",
  joumohd08:      "Head of HR",
};
const _appDisplayName = currentUser.name || currentUser.username;
const _appRoleLabel   = _appRoleLabels[_appProfileKey] || (currentUser.role === "admin" ? "Admin" : "Member");

// Populate mini hero
const _aPmhPhoto = document.getElementById("pmhPhoto");
const _aPmhName  = document.getElementById("pmhName");
const _aPmhRole  = document.getElementById("pmhRole");
if (_aPmhPhoto && currentUser.photo) { _aPmhPhoto.src = currentUser.photo; _aPmhPhoto.alt = _appDisplayName; }
if (_aPmhName) _aPmhName.textContent = _appDisplayName;
if (_aPmhRole) _aPmhRole.textContent = _appRoleLabel;

const welcomeText = document.getElementById("welcomeText");
const logoutBtn   = document.getElementById("logoutBtn");
const applicationsTrendChart = document.getElementById("applicationsTrendChart");
const applicationsTrendEmpty = document.getElementById("applicationsTrendEmpty");
const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");
const ANALYTICS_API_URL = `${API_BASE}/analytics`;

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

const fetchAnalyticsLogs = async () => {
  const response = await fetch(ANALYTICS_API_URL, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load analytics logs.");
  }

  const payload = await response.json();
  return payload && Array.isArray(payload.logs) ? payload.logs : [];
};

const renderApplicationsTrend = async () => {
  if (!applicationsTrendChart) return;

  if (!applicationsOpen) {
    applicationsTrendChart.innerHTML = "";
    if (applicationsTrendEmpty) {
      applicationsTrendEmpty.hidden = false;
      applicationsTrendEmpty.textContent = "Applications are not open yet. Traffic trend is 0 for now.";
    }
    return;
  }

  let logs = [];
  try {
    logs = await fetchAnalyticsLogs();
  } catch {
    logs = [];
  }

  const applicationsLogs = logs.filter((entry) => {
    const path = String(entry.path || "").trim().toLowerCase();
    return path === "applications" || path === "applications.html";
  });
  const byDate = applicationsLogs.reduce((acc, row) => {
    const d = new Date(String(row.timestamp || ""));
    if (Number.isNaN(d.getTime())) return acc;
    const key = d.toISOString().slice(0, 10);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const points = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-10);

  if (!points.length) {
    applicationsTrendChart.innerHTML = "";
    if (applicationsTrendEmpty) applicationsTrendEmpty.hidden = false;
    return;
  }

  if (applicationsTrendEmpty) applicationsTrendEmpty.hidden = true;

  const width = 600;
  const height = 180;
  const left = 40;
  const top = 20;
  const chartW = 530;
  const chartH = 120;
  const bottom = top + chartH;
  const maxVal = Math.max(1, ...points.map(([, count]) => count));
  const stepX = points.length > 1 ? chartW / (points.length - 1) : 0;

  const coords = points.map(([day, count], idx) => {
    const x = left + idx * stepX;
    const y = bottom - (count / maxVal) * chartH;
    return { day: day.slice(5), count, x, y };
  });

  const polyline = coords.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
  const dots = coords.map((p) => `
    <circle cx="${Math.round(p.x)}" cy="${Math.round(p.y)}" r="4.5" fill="#d5b465"></circle>
    <text x="${Math.round(p.x)}" y="${Math.round(p.y) - 10}" text-anchor="middle" font-size="10" fill="#f0daa0">${p.count}</text>
    <text x="${Math.round(p.x)}" y="${bottom + 14}" text-anchor="middle" font-size="10" fill="#9eb0a3">${p.day}</text>
  `).join("");

  applicationsTrendChart.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="rgba(8,14,10,0.7)"></rect>
    <line x1="${left}" y1="${bottom}" x2="${left + chartW}" y2="${bottom}" stroke="rgba(213,180,101,0.35)" stroke-width="1"></line>
    <polyline points="${polyline}" fill="none" stroke="rgba(77,139,99,0.95)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${dots}
  `;
};

renderApplicationsTrend();

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

  document.body.style.opacity = "0";
  requestAnimationFrame(() => {
    gsap.to(document.body, { opacity: 1, duration: 0.55, ease: "power2.out" });
  });

  if (!prefersReduced) {
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
