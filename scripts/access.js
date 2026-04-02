const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const passwordInput = document.getElementById("password");
const holdToViewBtn = document.getElementById("holdToViewBtn");
const loginBtn = document.getElementById("loginBtn");
const capsLockIndicator = document.getElementById("capsLockIndicator");
const adhamBurstTarget = document.getElementById("adhamBurstTarget");
const adhamFireLayer = document.getElementById("adhamFireLayer");
const cookieBanner = document.getElementById("cookieBanner");
const cookieAcceptBtn = document.getElementById("cookieAcceptBtn");
const cookieRejectBtn = document.getElementById("cookieRejectBtn");

const FAILED_ATTEMPTS_KEY = "imperium_failed_attempts";
const LOCKOUT_UNTIL_KEY = "imperium_lockout_until";
const COOKIE_CONSENT_KEY = "imperium_cookie_consent";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000;
// Capture original button HTML once so we can restore SVG after loading state
const LOGIN_BTN_ORIGINAL_HTML = loginBtn ? loginBtn.innerHTML : "Sign In";
const resetLoginBtn = () => {
  if (!loginBtn) return;
  loginBtn.classList.remove("is-loading");
  loginBtn.disabled = false;
  loginBtn.innerHTML = LOGIN_BTN_ORIGINAL_HTML;
};
const MAIN_ADMIN_USERNAME = "admin";
const SPECIAL_WELCOME_USERS = {
  "ln-obidat": {
    photo: "assets/under secretary general.png",
    title: "Welcome, Leen Obeidat",
    message: "USG access granted. Loading your dashboard...",
  },
  ahmadph: {
    photo: "assets/secretary general.png",
    title: "Welcome, Ahmed Pharaon",
    message: "SG access granted. Loading your dashboard...",
  },
  toleenkmedia: {
    photo: "assets/head of media.png",
    title: "Welcome, Toleen Kurdi",
    message: "Media access granted. Loading your dashboard...",
  },
  omaralhomran: {
    photo: "assets/Head of DA.png",
    title: "Welcome, Omar Alhomran",
    message: "Head of DA access granted. Loading your workspace...",
  },
  yamendalegend: {
    photo: "assets/HEAD OF CA.png",
    title: "Welcome, YAMEN ELATTAL",
    message: "Head of CA access granted. Loading your workspace...",
  },
  joumohd08: {
    photo: "assets/Joumana Mohamed .png",
    title: "Welcome, Joumana Mohamed",
    message: "Head of HR access granted. Loading your dashboard...",
  },
  y72n_e: {
    photo: "assets/Yassin elnaggar.jpg",
    title: "Welcome, Yassin elnaggar",
    message: "Head of HR access granted. Loading your dashboard...",
  },
};

const currentUser = window.ImperiumAuth.getCurrentUser();
if (currentUser) {
  window.location.href = "/dashboard";
}

const readCookieConsent = () => String(localStorage.getItem(COOKIE_CONSENT_KEY) || "").trim().toLowerCase();

const saveCookieConsent = (value) => {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // If storage is blocked, we still close the banner for this page view.
  }
};

const hideCookieBanner = () => {
  if (cookieBanner) {
    document.body.classList.remove("cookie-banner-visible");
    cookieBanner.classList.add("is-closing");
    cookieBanner.style.pointerEvents = "none";
    cookieBanner.style.opacity = "0";
    cookieBanner.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      cookieBanner.hidden = true;
      cookieBanner.style.display = "none";
      cookieBanner.classList.remove("is-closing");
    }, 120);
  }
};

const showCookieBannerIfNeeded = () => {
  if (!cookieBanner) {
    return;
  }

  const consent = readCookieConsent();
  cookieBanner.hidden = consent === "accepted" || consent === "rejected";
  document.body.classList.toggle("cookie-banner-visible", !cookieBanner.hidden);
  if (!cookieBanner.hidden) {
    cookieBanner.style.display = "flex";
    cookieBanner.style.pointerEvents = "auto";
    cookieBanner.style.opacity = "1";
    cookieBanner.removeAttribute("aria-hidden");
  }
};

if (cookieAcceptBtn) {
  cookieAcceptBtn.addEventListener("click", () => {
    cookieAcceptBtn.disabled = true;
    if (cookieRejectBtn) {
      cookieRejectBtn.disabled = true;
    }
    saveCookieConsent("accepted");
    hideCookieBanner();
  });
}

if (cookieRejectBtn) {
  cookieRejectBtn.addEventListener("click", () => {
    cookieRejectBtn.disabled = true;
    if (cookieAcceptBtn) {
      cookieAcceptBtn.disabled = true;
    }
    saveCookieConsent("rejected");
    hideCookieBanner();
  });
}

showCookieBannerIfNeeded();

const getFailedAttempts = () => Number(localStorage.getItem(FAILED_ATTEMPTS_KEY) || 0);
const setFailedAttempts = (count) => localStorage.setItem(FAILED_ATTEMPTS_KEY, String(Math.max(0, count)));

const getLockoutUntil = () => Number(localStorage.getItem(LOCKOUT_UNTIL_KEY) || 0);
const setLockoutUntil = (timestamp) => localStorage.setItem(LOCKOUT_UNTIL_KEY, String(timestamp));
const clearLockout = () => {
  localStorage.removeItem(LOCKOUT_UNTIL_KEY);
  setFailedAttempts(0);
};

const formatRemaining = (milliseconds) => {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const isLockedOut = () => {
  const lockoutUntil = getLockoutUntil();
  if (!lockoutUntil) {
    return false;
  }

  if (Date.now() >= lockoutUntil) {
    clearLockout();
    return false;
  }

  return true;
};

const renderLockoutState = () => {
  if (!isLockedOut()) {
    if (!loginBtn.classList.contains("is-loading")) {
      resetLoginBtn();
    }
    loginBtn.disabled = false;
    return;
  }

  const remaining = getLockoutUntil() - Date.now();
  resetLoginBtn();
  loginMessage.classList.remove("success");
  loginMessage.textContent = `Too many wrong attempts. Try again in ${formatRemaining(remaining)}. If the password is correct, you can still log in now.`;
};

let clickSpamLevel = 0;
let clickSpamTimer = null;

const spawnFireRing = (originXPercent, originYPercent) => {
  if (!adhamFireLayer) {
    return;
  }

  const ring = document.createElement("span");
  ring.className = "fire-ring";

  const size = 68 + Math.random() * 74;

  ring.style.setProperty("--x", `${originXPercent}%`);
  ring.style.setProperty("--y", `${originYPercent}%`);
  ring.style.setProperty("--size", `${size}px`);
  ring.style.setProperty("--h1", "2");
  ring.style.setProperty("--h2", "10");
  ring.style.setProperty("--h3", "350");

  ring.addEventListener("animationend", () => {
    ring.remove();
  });

  adhamFireLayer.appendChild(ring);
};

const triggerFireSpam = (event) => {
  if (!adhamBurstTarget) {
    return;
  }

  const rect = adhamBurstTarget.getBoundingClientRect();
  const relativeX = event.clientX ? ((event.clientX - rect.left) / rect.width) * 100 : 50;
  const relativeY = event.clientY ? ((event.clientY - rect.top) / rect.height) * 100 : 50;

  clickSpamLevel = Math.min(clickSpamLevel + 1, 12);
  const burstCount = Math.min(2 + clickSpamLevel, 14);

  for (let index = 0; index < burstCount; index += 1) {
    const jitterX = Math.max(15, Math.min(85, relativeX + (Math.random() - 0.5) * 28));
    const jitterY = Math.max(15, Math.min(85, relativeY + (Math.random() - 0.5) * 28));
    setTimeout(() => spawnFireRing(jitterX, jitterY), index * 28);
  }

  if (clickSpamTimer) {
    clearTimeout(clickSpamTimer);
  }
  clickSpamTimer = setTimeout(() => {
    clickSpamLevel = 0;
  }, 1300);
};

if (adhamBurstTarget && adhamFireLayer) {
  adhamBurstTarget.addEventListener("click", triggerFireSpam);
  adhamBurstTarget.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      triggerFireSpam({ clientX: 0, clientY: 0 });
    }
  });
}

renderLockoutState();

// Fade body in on page load
const runIntroFade = () => {
  requestAnimationFrame(() => {
    document.body.style.transition = "opacity 0.38s ease";
    document.body.style.opacity = "1";
  });
};

document.body.style.opacity = "0";
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", runIntroFade, { once: true });
} else {
  runIntroFade();
}

const showPassword = () => {
  passwordInput.type = "text";
};

const hidePassword = () => {
  passwordInput.type = "password";
};

const setCapsIndicator = (isOn) => {
  if (!capsLockIndicator) {
    return;
  }

  if (isOn) {
    capsLockIndicator.classList.add("show");
  } else {
    capsLockIndicator.classList.remove("show");
  }
};

const preloadImage = (src, timeoutMs = 420) => new Promise((resolve) => {
  const target = String(src || "").trim();
  if (!target) {
    resolve();
    return;
  }

  const image = new Image();
  let settled = false;

  const finish = () => {
    if (settled) return;
    settled = true;
    resolve();
  };

  const timer = setTimeout(finish, timeoutMs);

  image.onload = () => {
    clearTimeout(timer);
    if (typeof image.decode === "function") {
      image.decode().catch(() => {}).finally(finish);
    } else {
      finish();
    }
  };

  image.onerror = () => {
    clearTimeout(timer);
    finish();
  };

  image.src = target;
});

const showSpecialWelcomeAndRedirect = async (config) => {
  await preloadImage(config.photo);

  const overlay = document.createElement("div");
  overlay.className = "special-welcome-overlay";
  overlay.innerHTML = `
    <div class="special-welcome-card">
      <div class="special-photo-wrap" aria-hidden="true">
        <img src="${config.photo}" alt="" class="special-photo" loading="eager" decoding="async" fetchpriority="high" />
      </div>
      <h2>${config.title}</h2>
      <p>${config.message}</p>
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add("is-exiting");
  }, 1200);

  setTimeout(() => {
    window.location.href = config.redirectUrl || "/dashboard";
  }, 1550);
};

const redirectAfterLogin = (user) => {
  const username = String(user && user.username ? user.username : "").trim().toLowerCase();
  if (username === MAIN_ADMIN_USERNAME) {
    showSpecialWelcomeAndRedirect({
      photo: "assets/adham pic.jpg",
      title: "Welcome, Adham",
      message: "Main admin access granted. Loading your dashboard...",
      redirectUrl: "/dashboard",
    });
    return;
  }

  const specialConfig = SPECIAL_WELCOME_USERS[username];
  if (specialConfig) {
    showSpecialWelcomeAndRedirect({
      ...specialConfig,
      redirectUrl: "/dashboard",
    });
    return;
  }

  const fadeThen = (url, delay) => {
    if (typeof gsap !== "undefined") {
      setTimeout(() => {
        gsap.to(document.body, {
          opacity: 0, duration: 0.32, ease: "power2.in",
          onComplete: () => { window.location.href = url; },
        });
      }, delay);
    } else {
      setTimeout(() => { window.location.href = url; }, delay + 200);
    }
  };

  fadeThen("/dashboard", 480);
};

if (holdToViewBtn && passwordInput) {
  holdToViewBtn.addEventListener("mousedown", showPassword);
  holdToViewBtn.addEventListener("touchstart", showPassword, { passive: true });

  ["mouseup", "mouseleave", "touchend", "touchcancel", "blur"].forEach((eventName) => {
    holdToViewBtn.addEventListener(eventName, hidePassword);
  });
}

if (passwordInput) {
  ["keydown", "keyup"].forEach((eventName) => {
    passwordInput.addEventListener(eventName, (event) => {
      if (typeof event.getModifierState === "function") {
        setCapsIndicator(event.getModifierState("CapsLock"));
      }
    });
  });

  passwordInput.addEventListener("blur", () => {
    setCapsIndicator(false);
  });
}

// Keep portal motion subtle and stable.
(function initAccessGSAP() {
  if (typeof gsap === "undefined") return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  // ── Entrance timeline
  if (!prefersReduced) {
    const card      = document.querySelector(".access-login-card");
    const sidebar   = document.querySelector(".access-info-panel");
    const logoWrap  = document.querySelector(".access-logo-ring");
    const h1El      = document.querySelector(".access-title");
    const subtitleEl = document.querySelector(".access-subtitle");
    const formRows  = document.querySelectorAll("#loginForm .access-label, #loginForm input, #loginForm .password-wrap, .access-login-message, #loginForm .access-submit-btn");
    const roleBadges = document.querySelectorAll(".access-role-badge");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    if (card)       tl.from(card,      { y: 18, opacity: 0, scale: 0.985, duration: 0.48, ease: "power3.out" }, 0.08);
    if (sidebar)    tl.from(sidebar,   { y: 14, opacity: 0, duration: 0.42 }, 0.12);
    if (logoWrap)   tl.from(logoWrap,  { scale: 0.9, opacity: 0, duration: 0.4, ease: "power2.out" }, 0.16);
    if (h1El)       tl.from(h1El,      { y: 10, opacity: 0, duration: 0.34 }, 0.18);
    if (subtitleEl) tl.from(subtitleEl, { y: 8, opacity: 0, duration: 0.3 }, 0.22);
    if (formRows.length) tl.from(formRows, { y: 8, opacity: 0, stagger: 0.035, duration: 0.3 }, 0.24);
    if (roleBadges.length) tl.from(roleBadges, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out" }, 0.2);
  }

  // No magnetic button motion; keep interactions predictable.

  // ── Page exit: fade before navigating home
  const backLink = document.querySelector(".access-back-link");
  if (backLink) {
    backLink.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey) return;
      const href = backLink.getAttribute("href") || "/";
      e.preventDefault();
      gsap.to(document.body, {
        opacity: 0, duration: 0.3, ease: "power2.in",
        onComplete: () => { window.location.href = href; },
      });
    });
  }
})();

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (isLockedOut()) {
    const lockoutBypass = window.ImperiumAuth.login(username, password);
    if (lockoutBypass.success) {
      clearLockout();
      resetLoginBtn();
      loginMessage.classList.add("success");
      loginMessage.textContent = "dont be dum next time. Access granted. Redirecting...";

      redirectAfterLogin(lockoutBypass.user);
      return;
    }

    resetLoginBtn();
    renderLockoutState();
    return;
  }

  loginBtn.classList.add("is-loading");
  loginBtn.disabled = true;
  loginMessage.classList.remove("success");
  loginMessage.textContent = "Verifying credentials...";

  setTimeout(() => {
    if (isLockedOut()) {
      loginBtn.classList.remove("is-loading");
      renderLockoutState();
      return;
    }

    const result = window.ImperiumAuth.login(username, password);

    if (!result.success) {
      const failedAttempts = getFailedAttempts() + 1;
      setFailedAttempts(failedAttempts);

      resetLoginBtn();

      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
        renderLockoutState();
        return;
      }

      loginMessage.classList.remove("success");
      loginMessage.textContent = `${result.message} (${MAX_FAILED_ATTEMPTS - failedAttempts} attempts left before lockout.)`;
      return;
    }

    clearLockout();

    loginMessage.classList.add("success");
    loginMessage.textContent = "Access granted. Redirecting...";

    redirectAfterLogin(result.user);
  }, 900);
});
