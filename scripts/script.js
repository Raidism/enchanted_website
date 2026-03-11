const yearSpan = document.getElementById("year");
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

const WAITLIST_KEY = "imperium_waitlist";
const SITE_SETTINGS_STORAGE_KEY = "imperium_site_settings";
const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");
const WAITLIST_API_URL = `${API_BASE}/waitlist`;
const INSTAGRAM_API_URL = `${API_BASE}/instagram`;
const INSTAGRAM_USERNAME = "imperiummun26";
const newWaitlistId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fallbackSiteSettings = {
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

const getSiteSettings = () => {
  if (window.ImperiumAuth && typeof window.ImperiumAuth.getSiteSettings === "function") {
    return {
      ...fallbackSiteSettings,
      ...window.ImperiumAuth.getSiteSettings(),
    };
  }
  return fallbackSiteSettings;
};

const siteSettings = getSiteSettings();

const formatCompactCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return "0";
  }
  return Math.round(numeric).toLocaleString();
};

const setInstagramStatus = (message, state = "live") => {
  const statusEl = document.getElementById("instagramStatsStatus");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.remove("is-stale", "is-error");
  if (state === "stale") {
    statusEl.classList.add("is-stale");
  }
  if (state === "error") {
    statusEl.classList.add("is-error");
  }
};

const getManualInstagramStats = () => {
  const settings = getSiteSettings();
  if (String(settings.instagramStatsSource || "live").trim().toLowerCase() !== "manual") {
    return null;
  }

  const clean = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
  };

  return {
    followers: clean(settings.instagramFollowers, fallbackSiteSettings.instagramFollowers),
    posts: clean(settings.instagramPosts, fallbackSiteSettings.instagramPosts),
    following: clean(settings.instagramFollowing, fallbackSiteSettings.instagramFollowing),
    stale: false,
    source: "manual",
  };
};

const applyInstagramStats = (stats) => {
  const followersEl = document.getElementById("instagramFollowers");
  const postsEl = document.getElementById("instagramPosts");
  const followingEl = document.getElementById("instagramFollowing");

  if (!followersEl || !postsEl || !followingEl) {
    return;
  }

  const followers = Number(stats && stats.followers);
  const posts = Number(stats && stats.posts);
  const following = Number(stats && stats.following);

  const safeFollowers = Number.isFinite(followers) && followers >= 0
    ? followers
    : Number(followersEl.dataset.fallback || 0);
  const safePosts = Number.isFinite(posts) && posts >= 0
    ? posts
    : Number(postsEl.dataset.fallback || 0);
  const safeFollowing = Number.isFinite(following) && following >= 0
    ? following
    : Number(followingEl.dataset.fallback || 0);

  const allZero = safeFollowers === 0 && safePosts === 0 && safeFollowing === 0;
  const finalFollowers = allZero ? Number(followersEl.dataset.fallback || 0) : safeFollowers;
  const finalPosts = allZero ? Number(postsEl.dataset.fallback || 0) : safePosts;
  const finalFollowing = allZero ? Number(followingEl.dataset.fallback || 0) : safeFollowing;

  followersEl.textContent = formatCompactCount(finalFollowers);
  postsEl.textContent = formatCompactCount(finalPosts);
  followingEl.textContent = formatCompactCount(finalFollowing);

  const isManual = String(stats && stats.source || "").toLowerCase() === "manual";
  const isStale = Boolean(stats && stats.stale);
  if (allZero) {
    setInstagramStatus("Instagram sync delayed. Showing fallback numbers.", "stale");
  } else if (isManual) {
    setInstagramStatus("Live Instagram stats synced.", "live");
  } else if (isStale) {
    setInstagramStatus("Instagram sync delayed. Showing fallback numbers.", "stale");
  } else {
    setInstagramStatus("Live Instagram stats synced.", "live");
  }
};

const syncInstagramStats = async () => {
  const manualStats = getManualInstagramStats();
  if (manualStats) {
    applyInstagramStats(manualStats);
    return;
  }

  try {
    const response = await fetch(`${INSTAGRAM_API_URL}?username=${encodeURIComponent(INSTAGRAM_USERNAME)}&t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Instagram API returned ${response.status}`);
    }

    const payload = await response.json();
    applyInstagramStats(payload);
  } catch {
    setInstagramStatus("Instagram sync unavailable right now.", "error");
  }
};

syncInstagramStats();

window.addEventListener("storage", (event) => {
  if (event.key === SITE_SETTINGS_STORAGE_KEY) {
    syncInstagramStats();
  }
});

const parsedLaunchDate = new Date(siteSettings.launchDate);
const launchDate = Number.isNaN(parsedLaunchDate.getTime())
  ? new Date(fallbackSiteSettings.launchDate)
  : parsedLaunchDate;

const siteAnnouncement = document.getElementById("siteAnnouncement");
if (siteAnnouncement && siteSettings.announcement) {
  siteAnnouncement.hidden = false;
  siteAnnouncement.textContent = siteSettings.announcement;
}

const conferenceDescription = document.getElementById("conferenceDescription");
if (conferenceDescription && siteSettings.conferenceDescription) {
  conferenceDescription.textContent = siteSettings.conferenceDescription;
}

const conferenceLocation = document.getElementById("conferenceLocation");
if (conferenceLocation && siteSettings.locationText) {
  conferenceLocation.textContent = `Location: ${siteSettings.locationText}`;
}

const launchHeading = document.getElementById("launchHeading");
const launchHint = document.getElementById("launchHint");
if (siteSettings.applicationsOpen && launchHeading) {
  launchHeading.textContent = "Applications Are Live";
}
if (launchHint) {
  const conferenceDateText = " Conference date redacted.";
  launchHint.textContent = siteSettings.applicationsOpen
    ? `Applications are currently open.${conferenceDateText}`
    : `Launch target can be adjusted anytime by the organizing team.${conferenceDateText}`;
}

const SECRETARIAT_KEY = "imperium_secretariat";
const readSecretariat = () => {
  try {
    const raw = localStorage.getItem(SECRETARIAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const teamGrid = document.getElementById("teamGrid");
const secretariatRows = readSecretariat();
if (teamGrid && secretariatRows.length) {
  teamGrid.innerHTML = "";
  secretariatRows.forEach((member) => {
    const card = document.createElement("article");
    card.className = "team-card reveal pop-card";
    card.innerHTML = `
      <div class="team-photo-wrap">
        <img src="${String(member.photo || "assets/imperium mun logo.jpg").replace(/"/g, "&quot;")}" alt="${String(member.name || "Secretariat member").replace(/"/g, "&quot;")}" class="team-photo" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='assets/imperium mun logo.jpg';" />
        <img src="assets/Secretariat frame.png" alt="" class="team-photo-frame" loading="lazy" decoding="async" aria-hidden="true" />
      </div>
      <h3>${String(member.name || "Unknown").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h3>
      <p class="muted">${String(member.title || "Role").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      <p class="team-intro">${String(member.description || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    `;
    teamGrid.appendChild(card);
  });
}

if (siteSettings.maintenanceMode) {
  const _currentUser = window.ImperiumAuth && typeof window.ImperiumAuth.getCurrentUser === "function"
    ? window.ImperiumAuth.getCurrentUser()
    : null;
  const _isAdmin = _currentUser && _currentUser.role === "admin";

  if (_isAdmin) {
    // Admin sees the real site — just add a dismissible warning ribbon.
    const ribbon = document.createElement("div");
    ribbon.id = "maintenanceRibbon";
    ribbon.innerHTML =
      '<span>\uD83D\uDEE0\uFE0F <strong>Maintenance Mode is ON</strong> — Visitors see the maintenance screen.</span>' +
      '<a href="dashboard.html" style="margin-left:1rem;text-decoration:underline;">Turn it off in Dashboard</a>';
    Object.assign(ribbon.style, {
      position: "fixed", top: "0", left: "0", right: "0", zIndex: "9997",
      background: "#d5b465", color: "#0e1a12", textAlign: "center",
      padding: "0.55rem 1rem", fontSize: "0.82rem", fontWeight: "700",
    });
    document.documentElement.style.setProperty("--ribbon-offset", "2.4rem");
    document.body.appendChild(ribbon);
    // don't throw — admin sees real page
  } else {
    // Non-admin: show a full-screen overlay (real page still exists behind it)
    const overlay = document.createElement("div");
    overlay.id = "maintenanceOverlay";
    overlay.className = "maintenance-shell";
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", zIndex: "9998",
      background: "var(--bg, #050706)",
      display: "flex", alignItems: "center", justifyContent: "center",
    });

    const card = document.createElement("div");
    card.className = "maintenance-card";

    const title = document.createElement("h1");
    title.textContent = "Imperium MUN";

    const message = document.createElement("p");
    message.textContent = siteSettings.maintenanceMessage || fallbackSiteSettings.maintenanceMessage;

    const tttWrap = document.createElement("div");
    tttWrap.innerHTML =
      '<div class="ttt-game" id="tttGame">' +
        '<div class="ttt-header">' +
          '<p class="ttt-title">\u2665 Site Down? Play while you wait</p>' +
          '<div class="ttt-scores">' +
            '<span class="ttt-score-item" id="tttWins">W: 0</span>' +
            '<span class="ttt-score-sep">\u2022</span>' +
            '<span class="ttt-score-item ttt-score-draw" id="tttDraws">D: 0</span>' +
            '<span class="ttt-score-sep">\u2022</span>' +
            '<span class="ttt-score-item ttt-score-loss" id="tttLosses">L: 0</span>' +
          '</div>' +
        '</div>' +
        '<div class="ttt-status" id="tttStatus">Your turn (X)</div>' +
        '<div class="ttt-board" id="tttBoard">' +
          '<button class="ttt-cell" data-i="0" type="button"></button>' +
          '<button class="ttt-cell" data-i="1" type="button"></button>' +
          '<button class="ttt-cell" data-i="2" type="button"></button>' +
          '<button class="ttt-cell" data-i="3" type="button"></button>' +
          '<button class="ttt-cell" data-i="4" type="button"></button>' +
          '<button class="ttt-cell" data-i="5" type="button"></button>' +
          '<button class="ttt-cell" data-i="6" type="button"></button>' +
          '<button class="ttt-cell" data-i="7" type="button"></button>' +
          '<button class="ttt-cell" data-i="8" type="button"></button>' +
        '</div>' +
        '<button class="ttt-reset" id="tttReset" type="button">New Game</button>' +
      '</div>';

    const accessLink = document.createElement("a");
    accessLink.href = "access.html";
    accessLink.textContent = "Admin / Team Access";

    card.append(title, message, tttWrap, accessLink);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";
    initTicTacToe();
  }
}

const themeToggle = document.getElementById("themeToggle");
const themeStorageKey = "imperium-theme";
let isThemeAnimating = false;

const setTheme = (theme, withAnimation = false) => {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem(themeStorageKey, theme);

  if (!themeToggle) {
    return;
  }

  const nextTheme = theme === "dark" ? "light" : "dark";
  themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
  themeToggle.setAttribute("aria-pressed", String(theme === "light"));

  if (withAnimation) {
    themeToggle.classList.remove("is-animating");
    void themeToggle.offsetWidth;
    themeToggle.classList.add("is-animating");
  }
};

const storedTheme = localStorage.getItem(themeStorageKey);
const initialTheme = storedTheme === "light" || storedTheme === "dark"
  ? storedTheme
  : "dark";

setTheme(initialTheme);

const animateThemeWipe = ({ layerTheme, fromRadius, toRadius, originX, originY }) => {
  const layer = document.createElement("div");
  layer.className = "theme-wipe-layer";
  layer.setAttribute("data-theme", layerTheme);
  document.body.appendChild(layer);

  return new Promise((resolve) => {
    const animation = layer.animate(
      [
        { clipPath: `circle(${fromRadius}px at ${originX}px ${originY}px)` },
        { clipPath: `circle(${toRadius}px at ${originX}px ${originY}px)` },
      ],
      {
        duration: 620,
        easing: "cubic-bezier(0.22, 0.9, 0.28, 1)",
        fill: "forwards",
      }
    );

    animation.onfinish = () => {
      layer.remove();
      resolve();
    };

    animation.oncancel = () => {
      layer.remove();
      resolve();
    };
  });
};

if (themeToggle) {
  themeToggle.addEventListener("click", async (event) => {
    if (isThemeAnimating) {
      return;
    }

    const currentTheme = document.body.getAttribute("data-theme") || "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    if (prefersReducedMotion) {
      setTheme(nextTheme, true);
      return;
    }

    const rect = themeToggle.getBoundingClientRect();
    const originX = typeof event.clientX === "number" && event.clientX > 0
      ? event.clientX
      : rect.left + rect.width / 2;
    const originY = typeof event.clientY === "number" && event.clientY > 0
      ? event.clientY
      : rect.top + rect.height / 2;

    const farX = Math.max(originX, window.innerWidth - originX);
    const farY = Math.max(originY, window.innerHeight - originY);
    const maxRadius = Math.hypot(farX, farY);

    isThemeAnimating = true;
    themeToggle.disabled = true;

    try {
      if (nextTheme === "light") {
        // Dark → Light: white spreads outward from the toggle.
        setTheme("light", true);
        await animateThemeWipe({
          layerTheme: "light",
          fromRadius: 0,
          toRadius: maxRadius,
          originX,
          originY,
        });
      } else {
        // Light → Dark: white collapses back into the toggle.
        setTheme("dark", true);
        await animateThemeWipe({
          layerTheme: "light",
          fromRadius: maxRadius,
          toRadius: 0,
          originX,
          originY,
        });
      }
    } finally {
      themeToggle.disabled = false;
      isThemeAnimating = false;
    }
  });
}

const revealItems = document.querySelectorAll(".reveal");
const heroLogoCard = document.getElementById("heroLogoCard");
const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

if (heroLogoCard) {
  const baseDuration = 7;
  const minDuration = 0.55;
  let currentDuration = baseDuration;
  let targetDuration = baseDuration;
  let settleDuration = baseDuration;
  let lastBoostAt = 0;
  let ringAnimationFrameId = 0;

  heroLogoCard.style.setProperty("--logo-spin-duration", `${baseDuration}s`);

  const accelerateRing = () => {
    lastBoostAt = performance.now();

    // Capture the speed before this tap so the ring can glide back toward it.
    settleDuration = currentDuration;

    // Give a temporary boost on tap, but avoid harsh jumps.
    const boosted = Math.max(minDuration, currentDuration * 0.82);
    targetDuration = Math.min(targetDuration, boosted);

    if (!ringAnimationFrameId && !prefersReducedMotion) {
      ringAnimationFrameId = requestAnimationFrame(animateRingSpeed);
    }
  };

  const animateRingSpeed = () => {
    ringAnimationFrameId = 0;
    const now = performance.now();

    // Immediately after tap: move toward boosted speed.
    if (now - lastBoostAt <= 230) {
      currentDuration += (targetDuration - currentDuration) * 0.16;
    } else {
      // After tap: fall back toward the speed the user had before this tap.
      targetDuration += (settleDuration - targetDuration) * 0.1;
      currentDuration += (targetDuration - currentDuration) * 0.11;
    }

    // After user stops tapping for a while, return to default speed.
    if (now - lastBoostAt > 900) {
      settleDuration += (baseDuration - settleDuration) * 0.06;
      targetDuration += (settleDuration - targetDuration) * 0.06;
      if (Math.abs(baseDuration - settleDuration) < 0.01) {
        settleDuration = baseDuration;
      }
    }

    heroLogoCard.style.setProperty("--logo-spin-duration", `${currentDuration.toFixed(3)}s`);
    heroLogoCard.classList.toggle("is-spinning-fast", currentDuration < baseDuration * 0.92);

    const isNearlyIdle =
      now - lastBoostAt > 1400
      && Math.abs(currentDuration - baseDuration) < 0.02
      && Math.abs(targetDuration - baseDuration) < 0.02
      && Math.abs(settleDuration - baseDuration) < 0.02;

    if (!isNearlyIdle) {
      ringAnimationFrameId = requestAnimationFrame(animateRingSpeed);
    } else {
      currentDuration = baseDuration;
      targetDuration = baseDuration;
      settleDuration = baseDuration;
      heroLogoCard.style.setProperty("--logo-spin-duration", `${baseDuration}s`);
      heroLogoCard.classList.remove("is-spinning-fast");
    }
  };

  heroLogoCard.addEventListener("click", accelerateRing);
  heroLogoCard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      accelerateRing();
    }
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.08,
    rootMargin: "0px 0px -8% 0px",
  }
);

revealItems.forEach((item, index) => {
  if (isTouchDevice) {
    // Use a lighter, one-time reveal mode on touch devices to avoid scroll jitter.
    document.body.classList.add("mobile-reveal-lite");
    item.classList.add("show");
    return;
  }

  // GSAP ScrollTrigger handles all reveals when available — skip IntersectionObserver.
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    return;
  }

  const delay = item.classList.contains("pop-card")
    ? (index % 6) * 85
    : Math.min(index * 90, 360);
  item.style.transitionDelay = `${delay}ms`;
  observer.observe(item);
});

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const targetId = anchor.getAttribute("href");
    if (!targetId || targetId === "#") {
      return;
    }
    const target = document.querySelector(targetId);
    if (!target) {
      return;
    }
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const teamPhotoWraps = document.querySelectorAll(".team-photo-wrap");

const TEAM_FLARE_PALETTES = {
  sg: { h1: 210, h2: 228, h3: 195 },
  dsg: { h1: 0, h2: 0, h3: 0 },
  usg: { h1: 332, h2: 318, h3: 345 },
  default: { h1: 42, h2: 128, h3: 330 },
};

const getRolePalette = (roleText) => {
  const normalized = String(roleText || "").toLowerCase();

  if (normalized.includes("deputy secretary-general") || normalized.includes("(dsg)")) {
    return TEAM_FLARE_PALETTES.dsg;
  }

  if (normalized.includes("under secretary-general") || normalized.includes("(usg)")) {
    return TEAM_FLARE_PALETTES.usg;
  }

  if (normalized.includes("secretary-general") || normalized.includes("(sg)")) {
    return TEAM_FLARE_PALETTES.sg;
  }

  return TEAM_FLARE_PALETTES.default;
};

const spawnTeamFireRing = (fireLayer, originXPercent, originYPercent, palette) => {
  if (!fireLayer) {
    return;
  }

  const ring = document.createElement("span");
  ring.className = "team-fire-ring";

  const size = 68 + Math.random() * 74;

  ring.style.setProperty("--x", `${originXPercent}%`);
  ring.style.setProperty("--y", `${originYPercent}%`);
  ring.style.setProperty("--size", `${size}px`);
  ring.style.setProperty("--h1", String(palette.h1));
  ring.style.setProperty("--h2", String(palette.h2));
  ring.style.setProperty("--h3", String(palette.h3));

  ring.addEventListener("animationend", () => {
    ring.remove();
  });

  fireLayer.appendChild(ring);
};

teamPhotoWraps.forEach((wrap) => {
  let fireLayer = wrap.querySelector(".team-fire-layer");
  const card = wrap.closest(".team-card");
  const roleText = card ? card.querySelector(".muted")?.textContent : "";
  const palette = getRolePalette(roleText);

  if (!fireLayer) {
    fireLayer = document.createElement("span");
    fireLayer.className = "team-fire-layer";
    wrap.appendChild(fireLayer);
  }

  if (!wrap.hasAttribute("tabindex")) {
    wrap.setAttribute("tabindex", "0");
  }

  wrap.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  const triggerFireSpam = (event) => {
    const rect = wrap.getBoundingClientRect();
    const relativeX = event.clientX ? ((event.clientX - rect.left) / rect.width) * 100 : 50;
    const relativeY = event.clientY ? ((event.clientY - rect.top) / rect.height) * 100 : 50;
    const burstCount = 8;

    for (let index = 0; index < burstCount; index += 1) {
      const jitterX = Math.max(15, Math.min(85, relativeX + (Math.random() - 0.5) * 28));
      const jitterY = Math.max(15, Math.min(85, relativeY + (Math.random() - 0.5) * 28));
      setTimeout(() => spawnTeamFireRing(fireLayer, jitterX, jitterY, palette), index * 28);
    }
  };

  wrap.addEventListener("click", triggerFireSpam);
  wrap.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      triggerFireSpam({ clientX: 0, clientY: 0 });
    }
  });
});

const createEasterToast = () => {
  let toast = document.getElementById("easterToast");
  if (toast) {
    return toast;
  }

  toast = document.createElement("div");
  toast.id = "easterToast";
  toast.className = "easter-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);
  return toast;
};

const easterToast = createEasterToast();
let easterToastTimer = null;

const showEasterToast = (message) => {
  easterToast.textContent = message;
  easterToast.classList.add("show");

  if (easterToastTimer) {
    clearTimeout(easterToastTimer);
  }

  easterToastTimer = setTimeout(() => {
    easterToast.classList.remove("show");
  }, 1800);
};

const buildStarfieldIfMissing = () => {
  if (isTouchDevice || prefersReducedMotion) {
    return null;
  }

  let layer = document.querySelector(".diplomat-stars");
  if (layer) {
    return layer;
  }

  layer = document.createElement("div");
  layer.className = "diplomat-stars";
  layer.setAttribute("aria-hidden", "true");

  for (let index = 0; index < 22; index += 1) {
    const star = document.createElement("span");
    star.className = "star";
    star.style.setProperty("--x", `${Math.random() * 100}%`);
    star.style.setProperty("--y", `${Math.random() * 100}%`);
    star.style.setProperty("--delay", `${(Math.random() * 2.3).toFixed(2)}s`);
    star.style.setProperty("--dur", `${(2.8 + Math.random() * 2.7).toFixed(2)}s`);
    layer.appendChild(star);
  }

  document.body.appendChild(layer);
  return layer;
};

const brandLink = document.querySelector(".site-header .brand");
if (brandLink) {
  let clickCount = 0;
  let clickTimer = null;

  brandLink.addEventListener("click", () => {
    clickCount += 1;

    if (clickTimer) {
      clearTimeout(clickTimer);
    }

    clickTimer = setTimeout(() => {
      clickCount = 0;
      clickTimer = null;
    }, 540);

    if (clickCount >= 3) {
      clickCount = 0;
      document.body.classList.toggle("sigil-boost");
      showEasterToast(document.body.classList.contains("sigil-boost")
        ? "Imperium sigil awakened"
        : "Imperium sigil normalized");
    }
  });
}

const creditLine = document.querySelector(".main-credit");
if (creditLine) {
  let creditHits = 0;
  let creditTimer = null;

  creditLine.addEventListener("click", (event) => {
    if (event.target && event.target.closest(".credit-link")) {
      return;
    }

    creditHits += 1;

    if (creditTimer) {
      clearTimeout(creditTimer);
    }

    creditTimer = setTimeout(() => {
      creditHits = 0;
      creditTimer = null;
    }, 1700);

    if (creditHits >= 5) {
      creditHits = 0;
      const lines = [
        "Secretariat protocol: elegance under pressure.",
        "Diplomacy is a superpower. Keep leveling up.",
        "Imperium mode engaged: debate with purpose.",
      ];
      const pick = lines[Math.floor(Math.random() * lines.length)];
      showEasterToast(pick);
    }
  });
}

let keyBuffer = "";
document.addEventListener("keydown", (event) => {
  if (event.altKey || event.metaKey || event.ctrlKey) {
    return;
  }

  if (event.key.length === 1) {
    keyBuffer = `${keyBuffer}${event.key.toLowerCase()}`.slice(-12);
  }

  if (keyBuffer.endsWith("mun26")) {
    document.body.classList.toggle("diplomat-mode");
    if (document.body.classList.contains("diplomat-mode")) {
      buildStarfieldIfMissing();
    }
    showEasterToast(document.body.classList.contains("diplomat-mode")
      ? "Diplomat mode ON"
      : "Diplomat mode OFF");
    keyBuffer = "";
  }
});

const countDays = document.getElementById("countDays");
const countHours = document.getElementById("countHours");
const countMinutes = document.getElementById("countMinutes");
const countSeconds = document.getElementById("countSeconds");

const pad2 = (value) => String(value).padStart(2, "0");

const updateCountdown = () => {
  if (!countDays || !countHours || !countMinutes || !countSeconds) {
    return;
  }

  if (siteSettings.applicationsOpen) {
    countDays.textContent = "00";
    countHours.textContent = "00";
    countMinutes.textContent = "00";
    countSeconds.textContent = "00";
    return;
  }

  const countdownWrap = document.getElementById("countdown");
  if (countdownWrap) {
    countdownWrap.hidden = siteSettings.countdownEnabled === false;
    if (siteSettings.countdownEnabled === false) {
      return;
    }
  }

  const now = Date.now();
  const delta = Math.max(0, launchDate.getTime() - now);

  const days = Math.floor(delta / (1000 * 60 * 60 * 24));
  const hours = Math.floor((delta / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((delta / (1000 * 60)) % 60);
  const seconds = Math.floor((delta / 1000) % 60);

  countDays.textContent = pad2(days);
  countHours.textContent = pad2(hours);
  countMinutes.textContent = pad2(minutes);
  countSeconds.textContent = pad2(seconds);
};

updateCountdown();
setInterval(updateCountdown, 1000);

const waitlistForm = document.getElementById("waitlistForm");
const waitlistMessage = document.getElementById("waitlistMessage");
const waitlistCount = document.getElementById("waitlistCount");
const waitlistSubmitBtn = waitlistForm ? waitlistForm.querySelector('button[type="submit"]') : null;

const readWaitlistLocal = () => {
  try {
    const raw = localStorage.getItem(WAITLIST_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeWaitlistLocal = (rows) => {
  localStorage.setItem(WAITLIST_KEY, JSON.stringify(rows.slice(0, 3000)));
};

const fetchWaitlistRemote = async () => {
  const response = await fetch(WAITLIST_API_URL, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load remote waitlist.");
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.entries)) {
    throw new Error("Invalid waitlist payload.");
  }

  return payload.entries;
};

const postWaitlistRemote = async (entry) => {
  const response = await fetch(WAITLIST_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(entry),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    const message = payload && payload.message ? payload.message : "Unable to save waitlist entry.";
    throw new Error(message);
  }

  return payload;
};

const getWaitlistRows = async () => {
  try {
    const remoteRows = await fetchWaitlistRemote();
    writeWaitlistLocal(remoteRows);
    return remoteRows;
  } catch {
    return readWaitlistLocal();
  }
};

const refreshWaitlistCount = async () => {
  if (!waitlistCount) {
    return;
  }

  const rows = await getWaitlistRows();
  waitlistCount.textContent = String(rows.length);
};

refreshWaitlistCount();

const playWaitlistLaunchAnimation = (nameText) => new Promise((resolve) => {
  if (typeof gsap === "undefined") {
    resolve();
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "waitlist-launch-overlay";
  overlay.innerHTML = `
    <div class="waitlist-launch-scene">
      <div class="waitlist-launch-label">EARLY ACCESS RESERVED FOR ${String(nameText || "YOU").toUpperCase()}</div>
      <div class="waitlist-ship">
        <div class="waitlist-rocket">🚀</div>
      </div>
      <div class="waitlist-flame"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const scene = overlay.querySelector(".waitlist-launch-scene");
  const ship = overlay.querySelector(".waitlist-ship");
  const rocket = overlay.querySelector(".waitlist-rocket");
  const flame = overlay.querySelector(".waitlist-flame");
  let smokeActive = false;
  let flameTween = null;

  const getNozzlePoint = () => {
    if (!scene || !rocket) {
      return { x: 0, y: 0, shipRotation: 0 };
    }
    const sceneRect = scene.getBoundingClientRect();
    const rocketRect = rocket.getBoundingClientRect();
    const shipRotation = Number(gsap.getProperty(ship, "rotation")) || 0;
    return {
      x: (rocketRect.left - sceneRect.left) + rocketRect.width * 0.2,
      y: (rocketRect.top - sceneRect.top) + rocketRect.height * 0.62,
      shipRotation,
    };
  };

  const updateExhaustAnchor = () => {
    if (!flame) {
      return;
    }
    const nozzle = getNozzlePoint();
    gsap.set(flame, {
      x: nozzle.x,
      y: nozzle.y,
      xPercent: -100,
      yPercent: -50,
      rotation: nozzle.shipRotation,
      transformOrigin: "100% 50%",
    });
  };

  const spawnSmoke = () => {
    if (!scene || !rocket || !ship) {
      return;
    }

    const nozzle = getNozzlePoint();
    const angle = (nozzle.shipRotation * Math.PI) / 180;
    const backX = -Math.cos(angle);
    const backY = -Math.sin(angle);
    const perpX = -backY;
    const perpY = backX;

    const puff = document.createElement("span");
    puff.className = "waitlist-smoke";
    puff.style.left = `${nozzle.x}px`;
    puff.style.top = `${nozzle.y}px`;
    scene.appendChild(puff);

    const trailDistance = 30 + Math.random() * 56;
    const sidewaysJitter = (Math.random() - 0.5) * 20;
    gsap.fromTo(
      puff,
      { x: 0, y: 0, scale: 0.34, opacity: 0.78 },
      {
        x: backX * trailDistance + perpX * sidewaysJitter,
        y: backY * trailDistance + perpY * sidewaysJitter,
        scale: 1.55 + Math.random() * 0.85,
        opacity: 0,
        duration: 0.72,
        ease: "power2.out",
        onComplete: () => puff.remove(),
      }
    );
  };

  const emitSmoke = () => {
    if (!smokeActive) {
      return;
    }
    spawnSmoke();
    gsap.delayedCall(0.05 + Math.random() * 0.05, emitSmoke);
  };

  const sceneWidth = scene ? scene.clientWidth : 520;
  const sceneHeight = scene ? scene.clientHeight : 420;
  const travelX = Math.max(190, sceneWidth * 0.46);
  const travelY = -Math.max(230, sceneHeight * 0.64);

  const tl = gsap.timeline({
    onComplete: () => {
      smokeActive = false;
      if (flameTween) {
        flameTween.kill();
      }
      overlay.remove();
      resolve();
    },
  });

  updateExhaustAnchor();

  tl.to(overlay, { opacity: 1, duration: 0.2, ease: "power1.out" })
    .fromTo(ship, { x: -36, y: 18, rotate: -8, scale: 0.9, opacity: 0 }, { x: 0, y: 0, rotate: -2, scale: 1, opacity: 1, duration: 0.34, ease: "back.out(1.4)" }, "<")
    .to(flame, { opacity: 1, duration: 0.1, ease: "power1.out" }, "<")
    .add(() => {
      smokeActive = true;
      flameTween = gsap.to(flame, {
        scaleX: 1.32,
        scaleY: 0.84,
        duration: 0.1,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        transformOrigin: "100% 50%",
      });
      emitSmoke();
    }, "<")
    .to(ship, { x: travelX, y: travelY, rotate: 7, scale: 1.06, duration: 0.84, ease: "power3.in", onUpdate: updateExhaustAnchor }, ">")
    .add(() => {
      smokeActive = false;
      if (flameTween) {
        flameTween.kill();
      }
    }, "<")
    .to(flame, { scaleY: 0.2, opacity: 0, duration: 0.2, ease: "power1.in" }, "<")
    .to(overlay, { opacity: 0, duration: 0.28, ease: "power2.out" }, "-=0.16");
});

if (waitlistForm && waitlistMessage) {
  waitlistForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (siteSettings.applicationsOpen) {
      waitlistMessage.classList.remove("success");
      waitlistMessage.textContent = "Applications are open now. Please use the applications page.";
      return;
    }

    const saveEntry = async () => {
      const formData = new FormData(waitlistForm);
      const name = String(formData.get("waitlistName") || "").trim();
      const email = String(formData.get("waitlistEmail") || "").trim().toLowerCase();
      const school = String(formData.get("waitlistSchool") || "").trim();
      const role = String(formData.get("waitlistRole") || "delegate").trim();

      if (!name || !email || !school) {
        waitlistMessage.classList.remove("success");
        waitlistMessage.textContent = "Please complete all fields.";
        return;
      }

      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailValid) {
        waitlistMessage.classList.remove("success");
        waitlistMessage.textContent = "Please enter a valid email address.";
        return;
      }

      const entry = {
        name,
        email,
        school,
        role,
      };

      try {
        if (waitlistSubmitBtn) {
          waitlistSubmitBtn.disabled = true;
          waitlistSubmitBtn.textContent = "Reserving...";
        }
        const remotePayload = await postWaitlistRemote(entry);
        if (Array.isArray(remotePayload.entries)) {
          writeWaitlistLocal(remotePayload.entries);
        }

        waitlistForm.reset();
        await refreshWaitlistCount();
        await playWaitlistLaunchAnimation(name);

        waitlistMessage.classList.add("success");
        waitlistMessage.textContent = "You are in. We will notify you first when applications open.";
      } catch (error) {
        // Fallback for environments without Netlify function support.
        const rows = readWaitlistLocal();
        const exists = rows.some((item) => String(item.email || "").toLowerCase() === email);

        if (exists) {
          waitlistMessage.classList.remove("success");
          waitlistMessage.textContent = "You are already on the early list with this email.";
          return;
        }

        rows.unshift({
          id: newWaitlistId(),
          ...entry,
          addedAt: new Date().toISOString(),
          status: "pending",
          reviewedAt: "",
          reviewedBy: "",
        });

        writeWaitlistLocal(rows);
        waitlistForm.reset();
        await refreshWaitlistCount();
        await playWaitlistLaunchAnimation(name);

        waitlistMessage.classList.add("success");
        waitlistMessage.textContent = `Saved locally on this device only. (${String(error.message || "server unavailable")})`;
      } finally {
        if (waitlistSubmitBtn) {
          waitlistSubmitBtn.disabled = false;
          waitlistSubmitBtn.textContent = "Reserve Early Access 🔔";
        }
      }
    };

    saveEntry();
  });
}

const shareBtn = document.getElementById("shareBtn");
const shareMessage = document.getElementById("shareMessage");
const contactEmailLink = document.querySelector("#contact .email-link");
const contactCopyMessage = document.getElementById("contactCopyMessage");

if (contactEmailLink) {
  let contactCopyTimer = null;

  const setContactCopyMessage = (text, isSuccess = true) => {
    if (!contactCopyMessage) {
      return;
    }

    contactCopyMessage.textContent = text;
    contactCopyMessage.classList.toggle("contact-copy-message--error", !isSuccess);

    if (contactCopyTimer) {
      clearTimeout(contactCopyTimer);
    }

    contactCopyTimer = setTimeout(() => {
      contactCopyMessage.textContent = "";
      contactCopyMessage.classList.remove("contact-copy-message--error");
    }, 1800);
  };

  const copyContactEmail = async (emailAddress) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(emailAddress);
      return;
    }

    const helper = document.createElement("textarea");
    helper.value = emailAddress;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();

    if (!copied) {
      throw new Error("Copy command failed");
    }
  };

  contactEmailLink.addEventListener("click", async (event) => {
    event.preventDefault();
    const emailAddress = (contactEmailLink.textContent || "").trim();

    if (!emailAddress) {
      return;
    }

    try {
      await copyContactEmail(emailAddress);
      setContactCopyMessage("Email copied.");
    } catch {
      setContactCopyMessage("Could not copy automatically.", false);
    }
  });
}

if (shareBtn && shareMessage) {
  shareBtn.addEventListener("click", async () => {
    const sharePayload = {
      title: "Imperium MUN",
      text: "Join Imperium MUN in Riyadh. Diplomacy, debate, and leadership - applications opening soon.",
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        shareMessage.textContent = "Thanks for sharing Imperium MUN.";
        return;
      }

      await navigator.clipboard.writeText(`${sharePayload.text} ${sharePayload.url}`);
      shareMessage.textContent = "Share text copied. Paste it anywhere.";
    } catch {
      shareMessage.textContent = "Sharing was cancelled. You can still copy the page URL manually.";
    }
  });
}

// GSAP and ScrollTrigger animations are centralized in animations.js.
//  Tic Tac Toe (unbeatable minimax AI) 
function initTicTacToe() {
  const board    = document.getElementById("tttBoard");
  const status   = document.getElementById("tttStatus");
  const resetBtn = document.getElementById("tttReset");
  const winsEl   = document.getElementById("tttWins");
  const drawsEl  = document.getElementById("tttDraws");
  const lossesEl = document.getElementById("tttLosses");
  if (!board || !status || !resetBtn) return;

  const TTT_SCORE_KEY = "imperium_ttt_score";
  let scores = (() => {
    try { return JSON.parse(localStorage.getItem(TTT_SCORE_KEY) || "{}"); } catch { return {}; }
  })();
  scores = { wins: +(scores.wins||0), draws: +(scores.draws||0), losses: +(scores.losses||0) };

  const saveScores = () => {
    winsEl.textContent   = "W: " + scores.wins;
    drawsEl.textContent  = "D: " + scores.draws;
    lossesEl.textContent = "L: " + scores.losses;
    try { localStorage.setItem(TTT_SCORE_KEY, JSON.stringify(scores)); } catch {}
  };
  saveScores();

  const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  let cells, gameOver, humanTurn;

  const checkWinner = (b) => {
    for (const [a,c,d] of WINS) if (b[a] && b[a]===b[c] && b[a]===b[d]) return b[a];
    return b.includes(null) ? null : "draw";
  };

  const minimax = (b, isMax, alpha, beta) => {
    const w = checkWinner(b);
    if (w === "O") return 10;
    if (w === "X") return -10;
    if (w === "draw") return 0;
    let best = isMax ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] !== null) continue;
      b[i] = isMax ? "O" : "X";
      const score = minimax(b, !isMax, alpha, beta);
      b[i] = null;
      if (isMax) { best = Math.max(best, score); alpha = Math.max(alpha, best); }
      else        { best = Math.min(best, score); beta  = Math.min(beta,  best); }
      if (beta <= alpha) break;
    }
    return best;
  };

  const bestMove = (b) => {
    let best = -Infinity, move = -1;
    for (let i = 0; i < 9; i++) {
      if (b[i] !== null) continue;
      b[i] = "O";
      const s = minimax(b, false, -Infinity, Infinity);
      b[i] = null;
      if (s > best) { best = s; move = i; }
    }
    return move;
  };

  const renderBoard = () => {
    cells.forEach((val, i) => {
      const btn = board.querySelector(`[data-i="${i}"]`);
      btn.textContent = val || "";
      btn.className = "ttt-cell" + (val ? " ttt-taken ttt-" + val.toLowerCase() : "");
      btn.disabled = val !== null || gameOver || !humanTurn;
    });
  };

  const highlight = (combo) => {
    combo.forEach(i => board.querySelector(`[data-i="${i}"]`).classList.add("ttt-win"));
  };

  const endGame = (result) => {
    gameOver = true;
    if (result === "X") {
      status.textContent = "You win! ";
      status.className = "ttt-status ttt-win-msg";
      scores.wins++;
    } else if (result === "O") {
      status.textContent = "AI wins! ";
      status.className = "ttt-status ttt-loss-msg";
      scores.losses++;
    } else {
      status.textContent = "Draw! ";
      status.className = "ttt-status ttt-draw-msg";
      scores.draws++;
    }
    saveScores();
    for (const combo of WINS) {
      if (cells[combo[0]] && cells[combo[0]] === cells[combo[1]] && cells[combo[0]] === cells[combo[2]]) {
        highlight(combo);
        break;
      }
    }
    board.querySelectorAll(".ttt-cell").forEach(b => b.disabled = true);
  };

  const aiMove = () => {
    if (gameOver) return;
    const move = bestMove(cells);
    if (move === -1) return;
    cells[move] = "O";
    humanTurn = true;
    renderBoard();
    const w = checkWinner(cells);
    if (w) { endGame(w); return; }
    status.textContent = "Your turn (X)";
    status.className = "ttt-status";
  };

  const startGame = () => {
    cells = Array(9).fill(null);
    gameOver = false;
    humanTurn = true;
    status.textContent = "Your turn (X)";
    status.className = "ttt-status";
    board.querySelectorAll(".ttt-cell").forEach(b => {
      b.textContent = "";
      b.className = "ttt-cell";
      b.disabled = false;
    });
  };

  board.addEventListener("click", (e) => {
    const btn = e.target.closest(".ttt-cell");
    if (!btn || gameOver || !humanTurn) return;
    const i = +btn.getAttribute("data-i");
    if (cells[i] !== null) return;
    cells[i] = "X";
    humanTurn = false;
    renderBoard();
    const w = checkWinner(cells);
    if (w) { endGame(w); return; }
    status.textContent = "AI thinking";
    status.className = "ttt-status";
    setTimeout(aiMove, 340);
  });

  resetBtn.addEventListener("click", startGame);
  startGame();
}

//  Tic Tac Toe (unbeatable minimax AI
