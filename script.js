const yearSpan = document.getElementById("year");
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

const WAITLIST_KEY = "imperium_waitlist";
const WAITLIST_API_URL = "/.netlify/functions/waitlist";
const newWaitlistId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fallbackSiteSettings = {
  maintenanceMode: false,
  maintenanceMessage: "Imperium MUN is temporarily under maintenance. Please check back soon.",
  launchDate: "2026-03-28T00:00:00+03:00",
  announcement: "",
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
const parsedLaunchDate = new Date(siteSettings.launchDate);
const launchDate = Number.isNaN(parsedLaunchDate.getTime())
  ? new Date(fallbackSiteSettings.launchDate)
  : parsedLaunchDate;

const siteAnnouncement = document.getElementById("siteAnnouncement");
if (siteAnnouncement && siteSettings.announcement) {
  siteAnnouncement.hidden = false;
  siteAnnouncement.textContent = siteSettings.announcement;
}

if (siteSettings.maintenanceMode) {
  document.body.classList.add("site-maintenance");
  document.body.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "maintenance-shell";

  const card = document.createElement("div");
  card.className = "maintenance-card";

  const title = document.createElement("h1");
  title.textContent = "Imperium MUN";

  const message = document.createElement("p");
  message.textContent = siteSettings.maintenanceMessage || fallbackSiteSettings.maintenanceMessage;

  const accessLink = document.createElement("a");
  accessLink.href = "access.html";
  accessLink.textContent = "Admin / Team Access";

  card.append(title, message, accessLink);
  shell.appendChild(card);
  document.body.appendChild(shell);
  throw new Error("Website under maintenance mode");
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
const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
const initialTheme = storedTheme === "light" || storedTheme === "dark"
  ? storedTheme
  : prefersLight
    ? "light"
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

    if (nextTheme === "light") {
      // Dark -> Light: reveal light from toggle outward.
      await animateThemeWipe({
        layerTheme: "light",
        fromRadius: 0,
        toRadius: maxRadius,
        originX,
        originY,
      });
      setTheme("light", true);
    } else {
      // Light -> Dark: keep a shrinking light layer so dark closes inward to toggle.
      setTheme("dark", true);
      await animateThemeWipe({
        layerTheme: "light",
        fromRadius: maxRadius,
        toRadius: 0,
        originX,
        originY,
      });
    }

    themeToggle.disabled = false;
    isThemeAnimating = false;
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

  creditLine.addEventListener("click", () => {
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

if (waitlistForm && waitlistMessage) {
  waitlistForm.addEventListener("submit", (event) => {
    event.preventDefault();

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
        const remotePayload = await postWaitlistRemote(entry);
        if (Array.isArray(remotePayload.entries)) {
          writeWaitlistLocal(remotePayload.entries);
        }

        waitlistForm.reset();
        await refreshWaitlistCount();

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

        waitlistMessage.classList.add("success");
        waitlistMessage.textContent = `Saved locally on this device only. (${String(error.message || "server unavailable")})`;
      }
    };

    saveEntry();
  });
}

const shareBtn = document.getElementById("shareBtn");
const shareMessage = document.getElementById("shareMessage");

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