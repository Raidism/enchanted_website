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
const SPECIAL_WELCOME_USERNAME = "ln-obidat";
let nuhUhModeStarted = false;
let nuhUhIntervalId = null;

const currentUser = window.ImperiumAuth.getCurrentUser();
if (currentUser) {
  window.location.href = "dashboard.html";
}

const readCookieConsent = () => String(localStorage.getItem(COOKIE_CONSENT_KEY) || "").trim().toLowerCase();

const hideCookieBanner = () => {
  if (cookieBanner) {
    cookieBanner.hidden = true;
  }
};

const showCookieBannerIfNeeded = () => {
  if (!cookieBanner) {
    return;
  }

  const consent = readCookieConsent();
  cookieBanner.hidden = consent === "accepted" || consent === "rejected";
};

if (cookieAcceptBtn) {
  cookieAcceptBtn.addEventListener("click", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    hideCookieBanner();
  });
}

if (cookieRejectBtn) {
  cookieRejectBtn.addEventListener("click", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
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

const showSpecialWelcomeAndRedirect = () => {
  const overlay = document.createElement("div");
  overlay.className = "special-welcome-overlay";
  overlay.innerHTML = `
    <div class="special-welcome-card">
      <div class="special-photo-wrap" aria-hidden="true">
        <img src="assets/under secretary general.png" alt="" class="special-photo" loading="eager" decoding="async" />
        <img src="assets/Secretariat frame.png" alt="" class="special-frame" loading="eager" decoding="async" />
      </div>
      <h2>Welcome, Nina</h2>
      <p>USG access granted. Loading your dashboard...</p>
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add("is-exiting");
  }, 1200);

  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 1550);
};

const redirectAfterLogin = (user) => {
  const username = String(user && user.username ? user.username : "").trim().toLowerCase();
  if (username === SPECIAL_WELCOME_USERNAME) {
    showSpecialWelcomeAndRedirect();
    return;
  }

  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 500);
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
