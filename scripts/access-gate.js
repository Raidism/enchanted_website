const gateForm = document.getElementById("gateForm");
const gatePassword = document.getElementById("gatePassword");
const gateMessage = document.getElementById("gateMessage");
const gateButton = document.getElementById("gateButton");
const lockoutHint = document.getElementById("lockoutHint");
const mobileGateKeypad = document.getElementById("mobileGateKeypad");
const gateKeypadDisplay = document.getElementById("gateKeypadDisplay");
const keypadSubmitBtn = document.getElementById("keypadSubmitBtn");

if (window.EnchantedAuth && typeof window.EnchantedAuth.getCurrentUser === "function") {
  const signedInUser = window.EnchantedAuth.getCurrentUser();
  if (signedInUser) {
    window.location.replace("/dashboard");
  }
}

const FAILED_ATTEMPTS_KEY = "Enchanted Summit_gate_failed_attempts";
const LOCKOUT_UNTIL_KEY = "Enchanted Summit_gate_lockout_until";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000;

const API_BASE = "/api";

const getFailedAttempts = () => Number(localStorage.getItem(FAILED_ATTEMPTS_KEY) || 0);
const setFailedAttempts = (count) => localStorage.setItem(FAILED_ATTEMPTS_KEY, String(Math.max(0, count)));
const getLockoutUntil = () => Number(localStorage.getItem(LOCKOUT_UNTIL_KEY) || 0);
const setLockoutUntil = (value) => localStorage.setItem(LOCKOUT_UNTIL_KEY, String(value));

const isMobileDevice = () => {
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const ua = String(navigator.userAgent || "");
  return coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
};

const renderKeypadMask = () => {
  if (!gateKeypadDisplay) return;
  const count = String(gatePassword.value || "").length;
  gateKeypadDisplay.textContent = count ? "•".repeat(Math.min(count, 12)) : "••••";
};

const initMobileKeypad = () => {
  if (!mobileGateKeypad || !gatePassword) return;
  if (!isMobileDevice()) {
    mobileGateKeypad.hidden = true;
    gatePassword.style.display = "";
    if (gateButton) gateButton.style.display = "";
    return;
  }

  mobileGateKeypad.hidden = false;
  gatePassword.style.display = "none";
  if (gateButton) gateButton.style.display = "none";
  gatePassword.setAttribute("inputmode", "numeric");
  gatePassword.setAttribute("pattern", "[0-9]*");
  gatePassword.setAttribute("readonly", "readonly");

  mobileGateKeypad.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const key = target.getAttribute("data-key");
    const action = target.getAttribute("data-action");

    if (key && /^\d$/.test(key)) {
      gatePassword.value = `${gatePassword.value}${key}`.slice(0, 16);
      renderKeypadMask();
      return;
    }

    if (action === "clear") {
      gatePassword.value = "";
      renderKeypadMask();
      return;
    }

    if (action === "back") {
      gatePassword.value = gatePassword.value.slice(0, -1);
      renderKeypadMask();
    }
  });

  renderKeypadMask();
};

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
  if (!lockoutUntil) return false;
  if (Date.now() >= lockoutUntil) {
    clearLockout();
    return false;
  }
  return true;
};

const renderLockoutState = () => {
  if (!isLockedOut()) {
    gateButton.disabled = false;
    if (keypadSubmitBtn) keypadSubmitBtn.disabled = false;
    lockoutHint.hidden = true;
    return;
  }

  const remaining = getLockoutUntil() - Date.now();
  gateButton.disabled = false;
  if (keypadSubmitBtn) keypadSubmitBtn.disabled = false;
  gateMessage.classList.remove("success");
  gateMessage.classList.add("error");
  gateMessage.textContent = "Too many wrong attempts. You can still try the correct password now.";
  lockoutHint.hidden = false;
  lockoutHint.textContent = `Try again in ${formatRemaining(remaining)}.`;
};

const verifyGatePassword = async (password) => {
  const response = await fetch(`${API_BASE}/access-gate/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ password }),
    credentials: "same-origin",
  });

  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
};

renderLockoutState();
initMobileKeypad();

gateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const lockedBeforeSubmit = isLockedOut();

  const password = String(gatePassword.value || "");
  if (!password.trim()) {
    gateMessage.classList.remove("success");
    gateMessage.classList.add("error");
    gateMessage.textContent = "Password is required.";
    return;
  }

  gateButton.disabled = true;
  if (keypadSubmitBtn) keypadSubmitBtn.disabled = true;
  gateMessage.classList.remove("success", "error");
  gateMessage.textContent = "Checking password...";

  try {
    const result = await verifyGatePassword(password);

    if (result.ok && result.payload && result.payload.success) {
      clearLockout();
      gateMessage.classList.remove("error");
      gateMessage.classList.add("success");
      gateMessage.textContent = lockedBeforeSubmit
        ? "dont be dum next time. Access approved. Opening portal..."
        : "Access approved. Opening portal...";
      setTimeout(() => {
        window.location.href = String(result.payload.redirectPath || "/portal");
      }, 280);
      return;
    }

    const failedAttempts = getFailedAttempts() + 1;
    setFailedAttempts(failedAttempts);

    if (result.status === 429 || failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const retryMs = Number(result.payload && result.payload.retryMs);
      setLockoutUntil(Date.now() + (Number.isFinite(retryMs) && retryMs > 0 ? retryMs : LOCKOUT_DURATION_MS));
      renderLockoutState();
      return;
    }

    const attemptsLeft = Number(result.payload && result.payload.attemptsLeft);
    gateMessage.classList.remove("success");
    gateMessage.classList.add("error");
    gateMessage.textContent = Number.isFinite(attemptsLeft)
      ? `Wrong password. ${attemptsLeft} attempts left.`
      : `Wrong password. ${Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts)} attempts left.`;
  } catch {
    gateMessage.classList.remove("success");
    gateMessage.classList.add("error");
    gateMessage.textContent = "Unable to verify right now. Please try again.";
  } finally {
    if (!isLockedOut()) {
      gateButton.disabled = false;
      if (keypadSubmitBtn) keypadSubmitBtn.disabled = false;
    }
    renderKeypadMask();
  }
});