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
const DEFAULT_LOGIN_BUTTON_TEXT = "login";
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
};
let nuhUhModeStarted = false;
let nuhUhIntervalId = null;

const currentUser = window.ImperiumAuth.getCurrentUser();
if (currentUser) {
  window.location.href = currentUser.role === "admin" ? "dashboard.html" : "applications.html";
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
      loginBtn.textContent = DEFAULT_LOGIN_BUTTON_TEXT;
    }
    loginBtn.disabled = false;
    return;
  }

  const remaining = getLockoutUntil() - Date.now();
  loginBtn.classList.remove("is-loading");
  loginBtn.disabled = false;
  loginBtn.textContent = "nuh uh";
  loginMessage.classList.remove("success");
  loginMessage.textContent = `nuh uh — Too many wrong attempts. Try again in ${formatRemaining(remaining)} or contact the IT Team (Adham Soliman).`;
};

const startNuhUhMode = () => {
  if (nuhUhModeStarted) {
    return;
  }
  nuhUhModeStarted = true;

  const title = document.querySelector("h1");
  if (title) {
    title.textContent = "nuh uh";
  }

  const textTargets = [
    ...document.querySelectorAll("p, a, button, label, h2, h3, li, th, td, .subtitle, .brand, .back-home, .portal-footer"),
  ];

  let cursor = 0;
  nuhUhIntervalId = setInterval(() => {
    if (cursor >= textTargets.length) {
      clearInterval(nuhUhIntervalId);
      nuhUhIntervalId = null;
      return;
    }

    const target = textTargets[cursor];
    if (target && !target.classList.contains("scan-lines")) {
      target.textContent = "nuh uh";
    }
    cursor += 1;
  }, 110);
};

const stopNuhUhMode = () => {
  if (nuhUhIntervalId) {
    clearInterval(nuhUhIntervalId);
    nuhUhIntervalId = null;
  }
  nuhUhModeStarted = false;
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
setInterval(renderLockoutState, 1000);

// Fade body in on page load
document.body.style.opacity = "0";
window.addEventListener("DOMContentLoaded", () => {
  requestAnimationFrame(() => {
    document.body.style.transition = "opacity 0.38s ease";
    document.body.style.opacity = "1";
  });
});
if (document.readyState !== "loading") {
  requestAnimationFrame(() => {
    document.body.style.transition = "opacity 0.38s ease";
    document.body.style.opacity = "1";
  });
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

const showSpecialWelcomeAndRedirect = (config) => {
  const overlay = document.createElement("div");
  overlay.className = "special-welcome-overlay";
  overlay.innerHTML = `
    <div class="special-welcome-card">
      <div class="special-photo-wrap" aria-hidden="true">
        <img src="${config.photo}" alt="" class="special-photo" loading="eager" decoding="async" />
        <img src="assets/Secretariat frame.png" alt="" class="special-frame" loading="eager" decoding="async" />
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
    window.location.href = config.redirectUrl || "dashboard.html";
  }, 1550);
};

const redirectAfterLogin = (user) => {
  const username = String(user && user.username ? user.username : "").trim().toLowerCase();
  if (username === MAIN_ADMIN_USERNAME) {
    showSpecialWelcomeAndRedirect({
      photo: "assets/adham pic.jpg",
      title: "Welcome, Adham",
      message: "Main admin access granted. Loading your dashboard...",
      redirectUrl: "dashboard.html",
    });
    return;
  }

  const specialConfig = SPECIAL_WELCOME_USERS[username];
  if (specialConfig) {
    showSpecialWelcomeAndRedirect({
      ...specialConfig,
      redirectUrl: user && user.role === "admin" ? "dashboard.html" : "applications.html",
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

  fadeThen(user && user.role === "admin" ? "dashboard.html" : "applications.html", 480);
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

// ═══════════════════════════════════════════════════════════════
//  GSAP PREMIUM ENTRANCE ANIMATIONS
// ═══════════════════════════════════════════════════════════════
(function initAccessGSAP() {
  if (typeof gsap === "undefined") return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  // ── Entrance timeline
  if (!prefersReduced) {
    const header    = document.querySelector(".portal-header");
    const card      = document.querySelector(".access-card");
    const sidebar   = document.querySelector(".adham-side");
    const logoWrap  = document.querySelector(".portal-logo-wrap");
    const h1El      = document.querySelector(".access-card h1");
    const subtitleEl = document.querySelector(".access-card .subtitle");
    const formRows  = document.querySelectorAll(".login-form label, .login-form input, .login-form .password-wrap, .login-form .login-message, .login-form button");
    const roleBadges = document.querySelectorAll(".access-role-badge");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    if (header)     tl.from(header,    { y: -28, opacity: 0, duration: 0.6 }, 0);
    if (card)       tl.from(card,      { y: 36, opacity: 0, scale: 0.96, duration: 0.82, ease: "power4.out" }, 0.15);
    if (sidebar)    tl.from(sidebar,   { x: 32, opacity: 0, duration: 0.72 }, 0.3);
    if (logoWrap)   tl.from(logoWrap,  { scale: 0.72, opacity: 0, duration: 0.7, ease: "back.out(1.6)" }, 0.35);
    if (h1El)       tl.from(h1El,      { y: 18, opacity: 0, duration: 0.58 }, 0.5);
    if (subtitleEl) tl.from(subtitleEl, { y: 14, opacity: 0, duration: 0.5 }, 0.62);
    if (formRows.length) tl.from(formRows, { y: 16, opacity: 0, stagger: 0.07, duration: 0.5 }, 0.72);
    if (roleBadges.length) tl.from(roleBadges, { scale: 0.8, opacity: 0, stagger: 0.08, duration: 0.48, ease: "back.out(1.8)" }, 0.4);
  }

  // ── Magnetic login button (desktop only)
  if (!isTouch) {
    const loginBtnEl = document.getElementById("loginBtn");
    if (loginBtnEl) {
      loginBtnEl.addEventListener("mousemove", (e) => {
        const rect = loginBtnEl.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.22;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.22;
        gsap.to(loginBtnEl, { x, y, duration: 0.38, ease: "power2.out", overwrite: "auto" });
      });
      loginBtnEl.addEventListener("mouseleave", () => {
        gsap.to(loginBtnEl, { x: 0, y: 0, duration: 0.65, ease: "elastic.out(1, 0.5)", overwrite: "auto" });
      });
    }
  }

  // ── Page exit: fade before navigating to index.html
  const backLink = document.querySelector(".back-home");
  if (backLink) {
    backLink.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey) return;
      const href = backLink.getAttribute("href") || "index.html";
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
      stopNuhUhMode();
      loginBtn.classList.remove("is-loading");
      loginBtn.disabled = false;
      loginBtn.textContent = DEFAULT_LOGIN_BUTTON_TEXT;
      loginMessage.classList.add("success");
      loginMessage.textContent = "dont be dum next time. Access granted. Redirecting...";

      redirectAfterLogin(lockoutBypass.user);
      return;
    }

    loginBtn.textContent = "nuh uh";
    renderLockoutState();
    startNuhUhMode();
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

      loginBtn.classList.remove("is-loading");

      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
        loginBtn.textContent = "nuh uh";
        renderLockoutState();
        return;
      }

      loginBtn.disabled = false;
      loginBtn.textContent = DEFAULT_LOGIN_BUTTON_TEXT;
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
