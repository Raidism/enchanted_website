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
const _APP_PROFILE_FALLBACKS = {
  joumohd08: {
    name: "Joumana Mohamed",
    photo: "assets/Joumana Mohamed .png",
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

const teamAppsOpen = Boolean(siteSettings.teamApplicationsOpen);
const teamAppsCard = document.getElementById("teamAppsCard");
const teamAppsStatus = document.getElementById("teamAppsStatus");
const teamAppsPlaceholder = document.getElementById("teamAppsPlaceholder");
const teamAppsActive = document.querySelector(".team-apps-buttons") ? document.getElementById("teamAppsActive") : null;
const TEAM_LINKS = {
  security: "https://docs.google.com/forms/d/e/1FAIpQLSfrLZhVXPsgatwY1Z8tJWD6hEOjjKV1pgsFmb4CzriU0L9w7w/viewform?usp=header",
  media: "https://docs.google.com/forms/d/e/1FAIpQLSdKxP_oa4nUAn496celU3lgHEgun1yyEZxtKH74cAirlDPuNg/viewform?usp=header",
  volunteer: "https://docs.google.com/forms/d/e/1FAIpQLScwVL7U5YXXfua9w4qjaHA7oEIRHGRH9b5yjQXNUp8h3OfyoQ/viewform?usp=header",
};

if (teamAppsStatus) {
  teamAppsStatus.classList.toggle("is-open", teamAppsOpen);
  teamAppsStatus.classList.toggle("is-closed", !teamAppsOpen);
}

if (teamAppsCard) {
  teamAppsCard.classList.toggle("team-apps-card-open", teamAppsOpen);
}

if (teamAppsOpen && teamAppsActive) {
  if (teamAppsStatus) teamAppsStatus.textContent = "Open";
  if (teamAppsPlaceholder) teamAppsPlaceholder.style.display = "none";
  teamAppsActive.hidden = false;

  // Smooth animation for team app buttons
  const buttons = teamAppsActive.querySelectorAll("a[data-team]");
  if (typeof gsap !== "undefined" && buttons.length > 0) {
    buttons.forEach((btn, idx) => {
      gsap.from(btn, {
        opacity: 0,
        y: 12,
        duration: 0.4,
        delay: 0.05 + idx * 0.08,
        ease: "power2.out",
      });
      btn.addEventListener("mouseenter", () => {
        gsap.to(btn, { scale: 1.05, duration: 0.2, ease: "power2.out" });
      });
      btn.addEventListener("mouseleave", () => {
        gsap.to(btn, { scale: 1, duration: 0.15, ease: "power2.out" });
      });
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const team = btn.getAttribute("data-team");
      const url = TEAM_LINKS[team];
      if (url) {
        if (window.ImperiumTracker && window.ImperiumTracker.trackEvent) {
          window.ImperiumTracker.trackEvent("team_application_click", team);
        }

        buttons.forEach((item) => item.classList.add("is-disabled"));

        const navigate = () => {
          window.location.assign(url);
        };

        if (typeof gsap !== "undefined") {
          gsap.to(btn, {
            scale: 0.95,
            duration: 0.1,
            ease: "power2.in",
            onComplete: () => {
              btn.classList.add("is-selected");
              gsap.to(btn, { scale: 1.05, duration: 0.2, ease: "power2.out" });
              setTimeout(navigate, team === "volunteer" ? 320 : 180);
            },
          });
        } else {
          navigate();
        }
      }
    });
  });
} else {
  if (teamAppsStatus) teamAppsStatus.textContent = "Closed";
  if (teamAppsActive) teamAppsActive.hidden = true;
}

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

// Fetch click events specifically for trend analysis
const fetchClickEvents = async () => {
  const response = await fetch(`${API_BASE}/analytics/clicks`, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load analytics clicks.");
  }

  const payload = await response.json();
  return payload && Array.isArray(payload.clicks) ? payload.clicks : [];
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

  let clicks = [];
  try {
    clicks = await fetchClickEvents();
  } catch {
    clicks = [];
  }
  const teamEvents = clicks.filter((entry) => String(entry.event || "") === "team_application_click");

  const byDateAndTeam = teamEvents.reduce((acc, row) => {
    const d = new Date(String(row.timestamp || ""));
    if (Number.isNaN(d.getTime())) return acc;
    const dayKey = d.toISOString().slice(0, 10);
    const team = String(row.label || "").toLowerCase();
    if (!["media", "security", "volunteer"].includes(team)) return acc;
    if (!acc[dayKey]) acc[dayKey] = { media: 0, security: 0, volunteer: 0 };
    acc[dayKey][team] += 1;
    return acc;
  }, {});

  const ordered = Object.entries(byDateAndTeam)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-10);

  if (!ordered.length) {
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
  const series = {
    media: [],
    security: [],
    volunteer: [],
  };

  const stepX = ordered.length > 1 ? chartW / (ordered.length - 1) : 0;
  let maxVal = 1;

  ordered.forEach(([day, counts], idx) => {
    const x = left + idx * stepX;
    ["media", "security", "volunteer"].forEach((team) => {
      const v = counts[team] || 0;
      if (v > maxVal) maxVal = v;
      const y = bottom - (v / maxVal) * chartH;
      series[team].push({ x, y, v, day: day.slice(5) });
    });
  });

  const colorMap = {
    media: "#4fd1c5",
    security: "#f6ad55",
    volunteer: "#9f7aea",
  };

  const buildPolyline = (points, color) => {
    const coords = points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
    if (!coords) return "";
    return `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
  };

  const buildDots = (points, color) => points.map((p) => `
    <circle cx="${Math.round(p.x)}" cy="${Math.round(p.y)}" r="3.8" fill="${color}"></circle>
  `).join("");

  const mediaLine = buildPolyline(series.media, colorMap.media);
  const secLine = buildPolyline(series.security, colorMap.security);
  const volLine = buildPolyline(series.volunteer, colorMap.volunteer);

  const xLabels = ordered.map(([day], idx) => {
    const x = left + idx * stepX;
    return `<text x="${Math.round(x)}" y="${bottom + 14}" text-anchor="middle" font-size="10" fill="#9eb0a3">${day.slice(5)}</text>`;
  }).join("");

  const allDots = [
    buildDots(series.media, colorMap.media),
    buildDots(series.security, colorMap.security),
    buildDots(series.volunteer, colorMap.volunteer),
  ].join("");

  applicationsTrendChart.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="rgba(8,14,10,0.7)"></rect>
    <line x1="${left}" y1="${bottom}" x2="${left + chartW}" y2="${bottom}" stroke="rgba(213,180,101,0.35)" stroke-width="1"></line>
    ${mediaLine}
    ${secLine}
    ${volLine}
    ${allDots}
    ${xLabels}
    <rect x="${left}" y="${top - 12}" width="180" height="18" rx="9" fill="rgba(5,10,7,0.8)" stroke="rgba(213,180,101,0.3)" stroke-width="1"></rect>
    <circle cx="${left + 12}" cy="${top - 3}" r="4" fill="${colorMap.media}"></circle>
    <text x="${left + 20}" y="${top}" font-size="10" fill="#e2f0e6">Media</text>
    <circle cx="${left + 70}" cy="${top - 3}" r="4" fill="${colorMap.security}"></circle>
    <text x="${left + 78}" y="${top}" font-size="10" fill="#e2f0e6">Security</text>
    <circle cx="${left + 138}" cy="${top - 3}" r="4" fill="${colorMap.volunteer}"></circle>
    <text x="${left + 146}" y="${top}" font-size="10" fill="#e2f0e6">Volunteer</text>
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
