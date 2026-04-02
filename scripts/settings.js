const currentUser = window.ImperiumAuth.getCurrentUser();
if (!currentUser) {
  window.location.href = "/access";
  throw new Error("No active session");
}

if (currentUser.role !== "admin") {
  window.location.href = "/locked?feature=settings&from=dashboard";
  throw new Error("Settings is admin-only");
}

window.ImperiumAuth.heartbeat();
setInterval(() => window.ImperiumAuth.heartbeat(), 30000);

const logoutBtn = document.getElementById("logoutBtn");
const usersBody = document.getElementById("settingsUsersBody");
const usersMessage = document.getElementById("settingsUsersMessage");
const onlineList = document.getElementById("settingsOnlineList");
const historyList = document.getElementById("settingsHistoryList");
const historyPagination = document.getElementById("settingsHistoryPagination");
const reopenOnboardingBtn = document.getElementById("reopenOnboardingBtn");
const reopenOnboardingMessage = document.getElementById("reopenOnboardingMessage");
const HISTORY_PER_PAGE = 10;
const PAGE_WINDOW = 9;
let currentHistoryPage = 1;

const profileKey = String(currentUser.username || "").trim().toLowerCase();
const PROFILE_FALLBACKS = {
  joumohd08: {
    name: "Joumana Mohamed",
    photo: "assets/Joumana Mohamed .png",
  },
  y72n_e: {
    name: "Yassin elnaggar",
    photo: "assets/Yassin elnaggar.jpg",
  },
};
const profileFallback = PROFILE_FALLBACKS[profileKey] || {};
const profileDisplayName = String(profileFallback.name || currentUser.name || currentUser.username || "User");
const profilePhotoSrc = String(profileFallback.photo || currentUser.photo || "assets/imperium mun logo.jpg");

const pmhPhoto = document.getElementById("pmhPhoto");
const pmhName = document.getElementById("pmhName");
const pmhRole = document.getElementById("pmhRole");
const pmhHero = document.getElementById("pageMiniHero");
if (pmhPhoto) {
  pmhPhoto.src = profilePhotoSrc;
  pmhPhoto.alt = "";
}
if (pmhName) pmhName.textContent = profileDisplayName;
if (pmhRole) pmhRole.textContent = "Admin";
if (pmhHero) {
  pmhHero.classList.remove("profile-pending");
  pmhHero.classList.add("profile-ready");
}

const formatDateTime = (iso) => {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString();
};

const showLogoutTransition = () => {
  const displayName = profileDisplayName;
  const photoSrc = profilePhotoSrc;
  const overlay = document.createElement("div");
  overlay.className = "logout-overlay";
  overlay.innerHTML = `
    <div class="logout-card">
      <div class="logout-photo-ring">
        <img src="${photoSrc}" alt="" class="logout-photo" />
      </div>
      <p class="logout-name">${displayName}</p>
      <p class="logout-msg">Goodbye. See you next time.</p>
      <p class="logout-msg" style="font-size:.8rem;opacity:.4;margin-top:.1rem">Securing session…</p>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-visible"));

  if (typeof gsap !== "undefined") {
    const ring = overlay.querySelector(".logout-photo-ring");
    const card = overlay.querySelector(".logout-card");
    gsap.to(ring, { scale: 1.18, opacity: 0, duration: 0.65, ease: "power2.in", delay: 0.95 });
    gsap.to(card, { y: -24, opacity: 0, duration: 0.48, ease: "power2.in", delay: 1.1 });
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.4,
      ease: "power2.in",
      delay: 1.45,
      onComplete: () => {
        window.ImperiumAuth.logout();
        window.location.href = "/";
      },
    });
  } else {
    setTimeout(() => {
      window.ImperiumAuth.logout();
      window.location.href = "/";
    }, 1600);
  }
};

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    logoutBtn.classList.add("is-loading");
    logoutBtn.disabled = true;
    showLogoutTransition();
  });
}

if (reopenOnboardingBtn) {
  reopenOnboardingBtn.addEventListener("click", () => {
    reopenOnboardingBtn.disabled = true;
    if (reopenOnboardingMessage) {
      reopenOnboardingMessage.textContent = "Updating onboarding...";
    }

    const { success, message: msg } = window.ImperiumAuth.updateSiteSettings(currentUser, {
      onboardingReplayTriggered: true,
    });

    if (success) {
      if (reopenOnboardingMessage) {
        reopenOnboardingMessage.textContent = "Onboarding will display on next login. You can also open it now if you'd like to test it.";
        reopenOnboardingMessage.classList.add("success");
      }
      if (window.ImperiumOnboarding && typeof window.ImperiumOnboarding.open === "function") {
        setTimeout(() => {
          window.ImperiumOnboarding.open(currentUser, { force: true });
        }, 500);
      }
    } else {
      if (reopenOnboardingMessage) {
        reopenOnboardingMessage.textContent = msg || "Failed to update onboarding.";
        reopenOnboardingMessage.classList.add("error");
      }
    }

    reopenOnboardingBtn.disabled = false;
    setTimeout(() => {
      if (reopenOnboardingMessage) {
        reopenOnboardingMessage.textContent = "";
        reopenOnboardingMessage.className = "sub";
      }
    }, 4000);
  });
}

const renderUsers = () => {
  if (!usersBody) return;
  const users = window.ImperiumAuth.getUsersForAdmin(currentUser);
  const active = window.ImperiumAuth.getActiveUsers();
  const activeNames = new Set(Object.keys(active).map((k) => k.toLowerCase()));

  usersBody.innerHTML = "";
  users.forEach((user) => {
    const tr = document.createElement("tr");
    const maskedPassword = "********";
    const online = activeNames.has(String(user.username || "").toLowerCase());
    const isTargetAdmin = String(user.username || "").trim().toLowerCase() === "admin";
    const isDisabled = Boolean(user.disabled);
    const disableActionLabel = isDisabled ? "Enable" : "Disable";
    const disableActionMode = isDisabled ? "enable" : "disable";
    const statusClass = isDisabled ? "disabled" : (online ? "online" : "offline");
    const statusLabel = isDisabled ? "Disabled" : (online ? "Online" : "Offline");
    const passwordDisplay = isTargetAdmin
      ? `<code style="font-size:0.85em;background:rgba(255,255,255,0.06);padding:2px 7px;border-radius:5px;letter-spacing:0.03em">${String(user.password || "—")}</code>`
      : `<span class="masked-password" aria-label="Hidden password">${maskedPassword}</span>`;
    tr.innerHTML = `
      <td>${String(user.username || "")}</td>
      <td>${passwordDisplay}</td>
      <td>${String(user.name || "")}</td>
      <td>${String(user.role || "member")}</td>
      <td><span class="user-state user-state--${statusClass}"><span class="user-state-dot"></span>${statusLabel}</span></td>
      <td>
        ${isTargetAdmin
    ? '<span class="sub">Protected</span>'
    : `<button type="button" class="user-action-btn user-action-btn--toggle" data-user-action="${disableActionMode}" data-username="${String(user.username || "")}">${disableActionLabel}</button>`}
      </td>
      <td>
        ${isTargetAdmin
    ? '<span class="sub">Protected</span>'
    : `<button type="button" class="user-action-btn user-action-btn--lockout" data-user-action="force-lockout" data-username="${String(user.username || "")}">Force Lockout</button>`}
      </td>
    `;
    usersBody.appendChild(tr);
  });
};

if (usersBody) {
  usersBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const action = String(target.getAttribute("data-user-action") || "").trim();
    const username = String(target.getAttribute("data-username") || "").trim();
    if (!action || !username) return;

    target.disabled = true;
    let result = { success: false, message: "Unknown action." };

    if (action === "disable") {
      result = window.ImperiumAuth.setUserDisabled(currentUser, username, true);
    } else if (action === "enable") {
      result = window.ImperiumAuth.setUserDisabled(currentUser, username, false);
    } else if (action === "force-lockout") {
      result = window.ImperiumAuth.forceLogoutUser(currentUser, username);
    }

    if (usersMessage) {
      usersMessage.classList.toggle("success", Boolean(result.success));
      usersMessage.textContent = String(result.message || "Action completed.");
    }

    renderUsers();
    renderOnline();
    renderHistory();
  });
}

const renderOnline = () => {
  if (!onlineList) return;
  const active = window.ImperiumAuth.getActiveUsers();
  const rows = Object.values(active);
  onlineList.innerHTML = "";

  if (!rows.length) {
    const li = document.createElement("li");
    li.textContent = "No active sessions.";
    onlineList.appendChild(li);
    return;
  }

  rows
    .sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")))
    .forEach((row) => {
      const li = document.createElement("li");
      li.textContent = `${row.username} (${row.role}) • last seen ${formatDateTime(row.lastSeenAt)}`;
      onlineList.appendChild(li);
    });
};

const renderTeamAppsButtons = () => {
  const openBtn = document.getElementById("appsTeamOpenBtn");
  const closeBtn = document.getElementById("appsTeamCloseBtn");
  const statusDisplay = document.getElementById("appsTeamStatusDisplay");
  const message = document.getElementById("appsTeamMessage");
  if (!openBtn || !closeBtn) return;

  const updateDisplay = () => {
    const current = window.ImperiumAuth.getSiteSettings();
    const isOpen = Boolean(current.teamApplicationsOpen);
    if (statusDisplay) {
      statusDisplay.textContent = isOpen ? "🟢 Open for Recruiting" : "🔴 Closed";
      statusDisplay.classList.toggle("is-open", isOpen);
      statusDisplay.classList.toggle("is-closed", !isOpen);
    }
    openBtn.classList.toggle("is-active", isOpen);
    closeBtn.classList.toggle("is-active", !isOpen);
    openBtn.setAttribute("aria-pressed", String(isOpen));
    closeBtn.setAttribute("aria-pressed", String(!isOpen));
  };

  updateDisplay();

  const handleStateChange = (newState) => {
    return () => {
      openBtn.disabled = true;
      closeBtn.disabled = true;

      if (message) {
        message.textContent = "Updating...";
        message.className = "form-message";
      }

      const { success, message: msg } = window.ImperiumAuth.updateSiteSettings(currentUser, {
        teamApplicationsOpen: newState,
      });

      updateDisplay();
      openBtn.disabled = false;
      closeBtn.disabled = false;
      
      if (message) {
        message.textContent = success ? `Team Applications ${newState ? "Opened" : "Closed"}.` : msg;
        message.classList.toggle("success", success);
        message.classList.toggle("error", !success);
        setTimeout(() => { message.textContent = ""; }, 3000);
      }
    };
  };

  openBtn.addEventListener("click", handleStateChange(true));
  closeBtn.addEventListener("click", handleStateChange(false));
};

renderTeamAppsButtons();

const renderHistory = () => {
  if (!historyList) return;
  const rows = window.ImperiumAuth.getLoginHistory();
  historyList.innerHTML = "";

  const boundedRows = rows.slice(0, 120);
  const totalPages = Math.max(1, Math.ceil(boundedRows.length / HISTORY_PER_PAGE));
  currentHistoryPage = Math.min(currentHistoryPage, totalPages);

  const startIndex = (currentHistoryPage - 1) * HISTORY_PER_PAGE;
  const endIndex = startIndex + HISTORY_PER_PAGE;
  const slice = boundedRows.slice(startIndex, endIndex);

  if (!boundedRows.length) {
    const li = document.createElement("li");
    li.textContent = "No login history yet.";
    historyList.appendChild(li);
    if (historyPagination) {
      historyPagination.innerHTML = "";
    }
    return;
  }

  slice.forEach((row) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `
      <span class="history-main">${String(row.username || "Unknown")} <small>(${String(row.role || "member")})</small></span>
      <span class="history-meta">${formatDateTime(row.loginAt)}</span>
    `;
    historyList.appendChild(li);
  });

  if (!historyPagination) {
    return;
  }

  historyPagination.innerHTML = "";
  if (boundedRows.length <= HISTORY_PER_PAGE) {
    return;
  }

  const makeBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-btn";
    btn.textContent = label;
    btn.disabled = disabled;
    if (active) {
      btn.classList.add("active-page");
    }
    btn.addEventListener("click", () => {
      if (page === currentHistoryPage) return;
      currentHistoryPage = page;
      renderHistory();
    });
    return btn;
  };

  const windowStart = Math.floor((currentHistoryPage - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages);

  historyPagination.appendChild(makeBtn("Prev", Math.max(1, currentHistoryPage - 1), currentHistoryPage <= 1));
  for (let page = windowStart; page <= windowEnd; page += 1) {
    historyPagination.appendChild(makeBtn(String(page), page, false, page === currentHistoryPage));
  }
  historyPagination.appendChild(makeBtn("Next", Math.min(totalPages, currentHistoryPage + 1), currentHistoryPage >= totalPages));
};

renderUsers();
renderOnline();
renderHistory();
setInterval(() => {
  renderUsers();
  renderOnline();
}, 7000);
window.addEventListener("storage", () => {
  renderUsers();
  renderOnline();
  renderHistory();
});
