const currentUser = window.ImperiumAuth.getCurrentUser();
if (!currentUser) {
  window.location.href = "access.html";
  throw new Error("No active session");
}

const siteSettings = window.ImperiumAuth.getSiteSettings();
if (siteSettings.maintenanceMode && currentUser.role !== "admin") {
  window.location.href = "access.html";
  throw new Error("Maintenance mode is active for non-admin users");
}

window.ImperiumAuth.heartbeat();
setInterval(() => window.ImperiumAuth.heartbeat(), 30000);

const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const totalViews = document.getElementById("totalViews");
const uniqueIps = document.getElementById("uniqueIps");
const uniqueCountries = document.getElementById("uniqueCountries");
const visitsTableBody = document.getElementById("visitsTableBody");
const visitsPagination = document.getElementById("visitsPagination");
const adminPanel = document.getElementById("adminPanel");
const activeUsersList = document.getElementById("activeUsersList");
const addUserForm = document.getElementById("addUserForm");
const addUserMessage = document.getElementById("addUserMessage");
const siteSettingsForm = document.getElementById("siteSettingsForm");
const maintenanceModeInput = document.getElementById("maintenanceMode");
const maintenanceMessageInput = document.getElementById("maintenanceMessage");
const launchDateInput = document.getElementById("launchDateInput");
const announcementInput = document.getElementById("announcementInput");
const siteSettingsMessage = document.getElementById("siteSettingsMessage");
const userAccessList = document.getElementById("userAccessList");
const userAccessCard = userAccessList ? userAccessList.closest(".table-card") : null;
const adminProfilePhoto = document.getElementById("adminProfilePhoto");
const adminProfileCaption = document.getElementById("adminProfileCaption");
let isAddUserHandlerBound = false;
let isSiteSettingsHandlerBound = false;
let isUserAccessHandlerBound = false;
const VISITS_PER_PAGE = 10;
const PAGE_WINDOW = 9;
const ANALYTICS_API_URL = "/.netlify/functions/analytics";
let currentVisitPage = 1;
const isAdmin = currentUser.role === "admin";
const isMainAdmin = String(currentUser.username || "").trim().toLowerCase() === "admin";
const profileKey = String(currentUser.username || "").trim().toLowerCase();
const WELCOME_NAMES = {
  admin: "Adham",
  "ln-obidat": "Leen Obeidat",
  ahmadph: "Ahmed Pharaon",
};

const ADMIN_PROFILE_PRESETS = {
  admin: {
    photo: "assets/adham pic.jpg",
    caption: "Tough IT guy: Adham.",
    alt: "Adham profile",
  },
  "ln-obidat": {
    photo: "assets/under secretary general.png",
    caption: "Welcome back, Leen Obeidat (USG).",
    alt: "Leen profile",
  },
  ahmadph: {
    photo: "assets/secretary general.png",
    caption: "Welcome back, Ahmed Pharaon (SG).",
    alt: "Ahmed profile",
  },
};

if (isAdmin) {
  welcomeText.textContent = `Welcome ${WELCOME_NAMES[profileKey] || currentUser.username}`;
} else {
  welcomeText.textContent = `Welcome ${currentUser.username}`;
}

const showLogoutTransition = () => {
  const overlay = document.createElement("div");
  overlay.className = "logout-overlay";
  overlay.innerHTML = '<div class="logout-card">Securing session...</div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
};

logoutBtn.addEventListener("click", () => {
  logoutBtn.classList.add("is-loading");
  logoutBtn.disabled = true;
  showLogoutTransition();

  setTimeout(() => {
    window.ImperiumAuth.logout();
    window.location.href = "access.html";
  }, 900);
});

const readViewLogs = () => {
  try {
    const raw = localStorage.getItem("imperium_view_logs");
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeViewLogsLocal = (logs) => {
  localStorage.setItem("imperium_view_logs", JSON.stringify((Array.isArray(logs) ? logs : []).slice(0, 2000)));
};

const fetchViewLogsRemote = async () => {
  const response = await fetch(ANALYTICS_API_URL, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load remote analytics.");
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.logs)) {
    throw new Error("Invalid analytics payload.");
  }

  return payload.logs;
};

const getAnalyticsLogs = async () => {
  try {
    const remoteLogs = await fetchViewLogsRemote();
    writeViewLogsLocal(remoteLogs);
    return remoteLogs;
  } catch {
    return readViewLogs();
  }
};

const formatDateTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
};

const isUnknownValue = (value) => {
  const text = String(value || "").trim().toLowerCase();
  return !text || text === "unknown" || text === "--";
};

const deviceEmoji = (device) => {
  const text = String(device || "").toLowerCase();
  return text.includes("mobile") ? "📱" : "💻";
};

const pageLabel = (path) => {
  const raw = String(path || "").trim();
  return raw || "index.html";
};

const renderAdminProfile = () => {
  if (!adminProfilePhoto || !adminProfileCaption) {
    return;
  }

  const preset = ADMIN_PROFILE_PRESETS[profileKey] || {
    photo: "assets/imperium mun logo.jpg",
    caption: `Welcome ${currentUser.username}.`,
    alt: `${currentUser.username} profile`,
  };

  adminProfilePhoto.src = preset.photo;
  adminProfilePhoto.alt = preset.alt;
  adminProfileCaption.textContent = preset.caption;
};

const createPageButton = ({ label, page, disabled = false, isActive = false }) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-btn";
  button.textContent = label;
  button.disabled = disabled;

  if (isActive) {
    button.classList.add("active");
  }

  if (!disabled) {
    button.addEventListener("click", () => {
      currentVisitPage = page;
      renderAnalytics();
    });
  }

  return button;
};

const maskValue = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "******";
  }

  return "*".repeat(Math.max(6, Math.min(18, text.length)));
};

const toDateTimeLocalValue = (isoValue) => {
  const parsed = new Date(String(isoValue || ""));
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const tzOffset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - tzOffset).toISOString().slice(0, 16);
};

const fromDateTimeLocalValue = (localValue) => {
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
};

const renderVisitsPagination = (totalRows, totalPages) => {
  visitsPagination.innerHTML = "";

  if (totalRows <= VISITS_PER_PAGE) {
    return;
  }

  const windowStart = Math.floor((currentVisitPage - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages);

  visitsPagination.appendChild(
    createPageButton({ label: "←", page: Math.max(1, currentVisitPage - 1), disabled: currentVisitPage === 1 })
  );

  for (let page = windowStart; page <= windowEnd; page += 1) {
    visitsPagination.appendChild(
      createPageButton({ label: String(page), page, isActive: page === currentVisitPage })
    );
  }

  visitsPagination.appendChild(
    createPageButton({ label: "→", page: Math.min(totalPages, currentVisitPage + 1), disabled: currentVisitPage === totalPages })
  );
};

const renderAnalytics = async () => {
  const logs = await getAnalyticsLogs();
  const ipSet = new Set(logs.map((item) => item.ip).filter((value) => !isUnknownValue(value)));
  const countrySet = new Set(logs.map((item) => item.country).filter((value) => !isUnknownValue(value)));

  totalViews.textContent = String(logs.length);
  uniqueIps.textContent = String(ipSet.size);
  uniqueCountries.textContent = String(countrySet.size);

  const totalPages = Math.max(1, Math.ceil(logs.length / VISITS_PER_PAGE));
  currentVisitPage = Math.min(currentVisitPage, totalPages);

  const startIndex = (currentVisitPage - 1) * VISITS_PER_PAGE;
  const endIndex = startIndex + VISITS_PER_PAGE;
  const rows = logs.slice(startIndex, endIndex);
  visitsTableBody.innerHTML = "";

  if (rows.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = '<td colspan="5">No analytics yet.</td>';
    visitsTableBody.appendChild(emptyRow);
    visitsPagination.innerHTML = "";
    return;
  }

  rows.forEach((item) => {
    const row = document.createElement("tr");

    const rawIp = String(item.ip || "Unknown");
    const rawCountry = String(item.country || "Unknown");
    const ipValue = isAdmin ? rawIp : maskValue(rawIp);
    const countryValue = isAdmin
      ? `${item.flag || "🌐"} ${rawCountry}`
      : maskValue(rawCountry);
    const deviceValue = isAdmin ? `${deviceEmoji(item.device)} ${String(item.device || "Unknown")}` : maskValue(item.device);
    const pageValue = isAdmin ? `📄 ${pageLabel(item.path)}` : maskValue(item.path);

    row.innerHTML = `
      <td>${formatDateTime(item.timestamp)}</td>
      <td>${ipValue}</td>
      <td>${countryValue}</td>
      <td>${deviceValue}</td>
      <td>${pageValue}</td>
    `;
    visitsTableBody.appendChild(row);
  });

  renderVisitsPagination(logs.length, totalPages);
};

const renderAdminPanel = () => {
  if (!isAdmin) {
    adminPanel.hidden = true;
    if (addUserForm) {
      addUserForm.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = true;
      });
    }

    if (siteSettingsForm) {
      siteSettingsForm.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = true;
      });
    }

    return;
  }

  adminPanel.hidden = false;
  renderAdminProfile();

  const activeUsers = window.ImperiumAuth.getActiveUsers();
  const entries = Object.values(activeUsers);

  activeUsersList.innerHTML = "";
  if (entries.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No active sessions.";
    activeUsersList.appendChild(li);
  } else {
    entries.sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")));
    entries.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = `${entry.username} (${entry.role}) • last seen ${formatDateTime(entry.lastSeenAt)}`;
      activeUsersList.appendChild(li);
    });
  }

  if (!isAddUserHandlerBound) {
    addUserForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const formData = new FormData(addUserForm);
      const username = String(formData.get("newUsername") || "").trim();
      const password = String(formData.get("newPassword") || "").trim();
      const role = String(formData.get("newRole") || "member").trim();

      const result = window.ImperiumAuth.addUser(currentUser, username, password, role);

      addUserMessage.classList.toggle("success", result.success);
      addUserMessage.textContent = result.message;

      if (result.success) {
        addUserForm.reset();
      }
    });
    isAddUserHandlerBound = true;
  }

  if (siteSettingsForm && maintenanceModeInput && maintenanceMessageInput && launchDateInput && announcementInput) {
    const settings = window.ImperiumAuth.getSiteSettings();
    maintenanceModeInput.value = settings.maintenanceMode ? "on" : "off";
    maintenanceMessageInput.value = String(settings.maintenanceMessage || "");
    launchDateInput.value = toDateTimeLocalValue(settings.launchDate);
    announcementInput.value = String(settings.announcement || "");

    if (!isSiteSettingsHandlerBound) {
      siteSettingsForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const updateResult = window.ImperiumAuth.updateSiteSettings(currentUser, {
          maintenanceMode: maintenanceModeInput.value === "on",
          maintenanceMessage: String(maintenanceMessageInput.value || "").trim(),
          launchDate: fromDateTimeLocalValue(String(launchDateInput.value || "").trim()),
          announcement: String(announcementInput.value || "").trim(),
        });

        siteSettingsMessage.classList.toggle("success", updateResult.success);
        siteSettingsMessage.textContent = updateResult.message;
      });
      isSiteSettingsHandlerBound = true;
    }
  }

  if (userAccessList) {
    if (userAccessCard) {
      userAccessCard.hidden = !isMainAdmin;
    }

    if (!isMainAdmin) {
      userAccessList.innerHTML = "";
      return;
    }

    const users = window.ImperiumAuth.getUsers();
    userAccessList.innerHTML = "";

    users.sort((a, b) => String(a.username || "").localeCompare(String(b.username || "")));

    users.forEach((user) => {
      const li = document.createElement("li");
      const status = user.disabled ? "Disabled" : "Active";

      li.innerHTML = `
        <span>${user.username} (${user.role}) • ${status}</span>
        <button class="mini-btn" data-user="${user.username}" data-disabled="${user.disabled ? "1" : "0"}" type="button" ${user.username === "admin" ? "disabled" : ""}>
          ${user.disabled ? "Enable" : "Disable"}
        </button>
      `;

      userAccessList.appendChild(li);
    });

    if (!isUserAccessHandlerBound) {
      userAccessList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
          return;
        }

        const username = target.getAttribute("data-user") || "";
        const disabledFlag = target.getAttribute("data-disabled") === "1";
        const result = window.ImperiumAuth.setUserDisabled(currentUser, username, !disabledFlag);

        if (siteSettingsMessage) {
          siteSettingsMessage.classList.toggle("success", result.success);
          siteSettingsMessage.textContent = result.message;
        }

        if (result.success) {
          renderAdminPanel();
        }
      });
      isUserAccessHandlerBound = true;
    }
  }
};

  renderAnalytics();
renderAdminPanel();

let analyticsIntervalId = null;
let adminIntervalId = null;

const clearRefreshIntervals = () => {
  if (analyticsIntervalId) {
    clearInterval(analyticsIntervalId);
    analyticsIntervalId = null;
  }

  if (adminIntervalId) {
    clearInterval(adminIntervalId);
    adminIntervalId = null;
  }
};

const startRefreshIntervals = () => {
  if (!analyticsIntervalId) {
    analyticsIntervalId = setInterval(renderAnalytics, 5000);
  }

  if (!adminIntervalId) {
    adminIntervalId = setInterval(renderAdminPanel, 7000);
  }
};

const syncRefreshState = () => {
  if (document.hidden) {
    clearRefreshIntervals();
    return;
  }

  renderAnalytics();
  renderAdminPanel();
  startRefreshIntervals();
};

document.addEventListener("visibilitychange", syncRefreshState);
window.addEventListener("storage", (event) => {
  if (["imperium_view_logs", "imperium_active_users", "imperium_users", "imperium_site_settings"].includes(event.key || "")) {
    renderAnalytics();
    renderAdminPanel();
  }
});

startRefreshIntervals();
