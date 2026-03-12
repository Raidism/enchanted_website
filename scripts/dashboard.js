const currentUser = window.ImperiumAuth.getCurrentUser();
if (!currentUser) {
  window.location.href = "/access";
  throw new Error("No active session");
}

const siteSettings = window.ImperiumAuth.getSiteSettings();
if (siteSettings.maintenanceMode && currentUser.role !== "admin") {
  window.location.href = "/access";
  throw new Error("Maintenance mode is active for non-admin users");
}

window.ImperiumAuth.heartbeat();
setInterval(() => window.ImperiumAuth.heartbeat(), 30000);

const welcomeText = null; // legacy – replaced by dwh-* elements
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
const dwhPhoto   = document.getElementById("dwhPhoto");
const dwhNameEl  = document.getElementById("dwhName");
const dwhRoleEl  = document.getElementById("dwhRole");
const dwhBriefing = document.getElementById("dwhBriefing");
const dwhCursor  = document.querySelector(".dwh-cursor");
const instagramStatsAdminCard = document.getElementById("instagramStatsAdminCard");
const instagramStatsForm = document.getElementById("instagramStatsForm");
const instagramStatsSourceInput = document.getElementById("instagramStatsSource");
const instagramFollowersInput = document.getElementById("instagramFollowersInput");
const instagramPostsInput = document.getElementById("instagramPostsInput");
const instagramFollowingInput = document.getElementById("instagramFollowingInput");
const instagramStatsMessage = document.getElementById("instagramStatsMessage");
// legacy spotlight IDs no longer in DOM
const userSpotlightPhoto = null;
const userSpotlightName  = null;
const userSpotlightRole  = null;
let isAddUserHandlerBound = false;
let isSiteSettingsHandlerBound = false;
let isUserAccessHandlerBound = false;
let isInstagramStatsHandlerBound = false;
const VISITS_PER_PAGE = 10;
const PAGE_WINDOW = 9;
const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");
const ANALYTICS_API_URL = `${API_BASE}/analytics`;
let currentVisitPage = 1;
const isAdmin = currentUser.role === "admin";
const isMainAdmin = String(currentUser.username || "").trim().toLowerCase() === "admin";
const profileKey = String(currentUser.username || "").trim().toLowerCase();
const DEFAULT_INSTAGRAM_STATS = {
  followers: 487,
  posts: 18,
  following: 4,
};
const WELCOME_NAMES = {
  admin: "Adham Mohamed",
  "ln-obidat": "Leen Obeidat",
  ahmadph: "Ahmed Pharaon",
  toleenkmedia: "Toleen Kurdi",
  omaralhomran: "Omar Alhomran",
  yamendalegend: "YAMEN ELATTAL",
};

const ADMIN_PROFILE_PRESETS = {
  admin: {
    photo: "assets/adham pic.jpg",
    caption: "Welcome back, Adham Mohamed (Head of IT).",
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
  toleenkmedia: {
    photo: "assets/head of media.png",
    caption: "Welcome back, Toleen Kurdi (Head of Media).",
    alt: "Toleen profile",
  },
  omaralhomran: {
    photo: "assets/Head of DA.png",
    caption: "Welcome back, Omar Alhomran (Head of DA).",
    alt: "Omar profile",
  },
  yamendalegend: {
    photo: "assets/HEAD OF CA.png",
    caption: "Welcome back, YAMEN ELATTAL (Head of CA).",
    alt: "Yamen profile",
  },
};

const USER_SPOTLIGHT_PRESETS = {
  admin: {
    name: "Adham Mohamed",
    role: "Head of IT",
    photo: "assets/adham pic.jpg",
  },
  "ln-obidat": {
    name: "Leen Obeidat",
    role: "Under Secretary General",
    photo: "assets/under secretary general.png",
  },
  ahmadph: {
    name: "Ahmed Pharaon",
    role: "Secretary General",
    photo: "assets/secretary general.png",
  },
  toleenkmedia: {
    name: "Toleen Kurdi",
    role: "Head of Media",
    photo: "assets/head of media.png",
  },
  omaralhomran: {
    name: "Omar Alhomran",
    role: "Head of DA",
    photo: "assets/Head of DA.png",
  },
  yamendalegend: {
    name: "YAMEN ELATTAL",
    role: "Head of CA",
    photo: "assets/HEAD OF CA.png",
  },
};

const applyMemberLocks = () => {
  if (isAdmin) return;

  document.body.classList.add("member-locked-view");

  const lockedSections = document.querySelectorAll("[data-admin-lock]");
  lockedSections.forEach((section) => {
    section.classList.add("is-locked");
  });

  const adminLinks = document.querySelectorAll("[data-admin-link]");
  adminLinks.forEach((link) => {
    link.classList.add("locked-link");
    link.setAttribute("aria-disabled", "true");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const href = String(link.getAttribute("href") || "").toLowerCase();
      const feature = href.includes("ops") ? "ops" : (href.includes("settings") ? "settings" : "restricted");
      window.location.href = `/locked?feature=${encodeURIComponent(feature)}&from=dashboard`;
    });
  });
};

applyMemberLocks();

const renderInstagramStatsPanel = () => {
  if (!instagramStatsAdminCard || !instagramStatsForm) {
    return;
  }

  if (!isAdmin) {
    instagramStatsForm.querySelectorAll("input, select, button").forEach((el) => {
      el.disabled = true;
    });
    return;
  }

  const settings = window.ImperiumAuth.getSiteSettings();
  const normalizeCount = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
  };
  const defaultFollowers = normalizeCount(settings.instagramFollowers, DEFAULT_INSTAGRAM_STATS.followers);
  const defaultPosts = normalizeCount(settings.instagramPosts, DEFAULT_INSTAGRAM_STATS.posts);
  const defaultFollowing = normalizeCount(settings.instagramFollowing, DEFAULT_INSTAGRAM_STATS.following);

  if (instagramStatsSourceInput) {
    instagramStatsSourceInput.value = String(settings.instagramStatsSource || "live") === "manual" ? "manual" : "live";
  }
  if (instagramFollowersInput) {
    instagramFollowersInput.value = String(defaultFollowers);
  }
  if (instagramPostsInput) {
    instagramPostsInput.value = String(defaultPosts);
  }
  if (instagramFollowingInput) {
    instagramFollowingInput.value = String(defaultFollowing);
  }

  if (!isInstagramStatsHandlerBound) {
    instagramStatsForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const source = String((instagramStatsSourceInput && instagramStatsSourceInput.value) || "live").trim().toLowerCase();
      const followers = normalizeCount(instagramFollowersInput && instagramFollowersInput.value, defaultFollowers);
      const posts = normalizeCount(instagramPostsInput && instagramPostsInput.value, defaultPosts);
      const following = normalizeCount(instagramFollowingInput && instagramFollowingInput.value, defaultFollowing);

      const result = window.ImperiumAuth.updateSiteSettings(currentUser, {
        instagramStatsSource: source === "manual" ? "manual" : "live",
        instagramFollowers: followers,
        instagramPosts: posts,
        instagramFollowing: following,
      });

      if (instagramStatsMessage) {
        instagramStatsMessage.classList.toggle("success", result.success);
        instagramStatsMessage.textContent = result.success
          ? "Instagram snapshot settings saved."
          : result.message;
      }

      if (result.success) {
        renderInstagramStatsPanel();
      }
    });

    isInstagramStatsHandlerBound = true;
  }
};

// ═══════════════════════════════════════════════════════════════
//  NOTES SYSTEM
// ═══════════════════════════════════════════════════════════════
const NOTES_KEY = "imperium_staff_notes";

const readNotes = () => {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const writeNotes = (notes) => {
  localStorage.setItem(NOTES_KEY, JSON.stringify(Array.isArray(notes) ? notes : []));
};

const renderITNotes = () => {
  const list   = document.getElementById("itNotesList");
  const empty  = document.getElementById("itNotesEmpty");
  if (!list) return;

  const notes = readNotes().filter((n) => !n.resolved);
  list.innerHTML = "";

  if (notes.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  notes
    .slice()
    .sort((a, b) => {
      if (a.priority === "urgent" && b.priority !== "urgent") return -1;
      if (b.priority === "urgent" && a.priority !== "urgent") return 1;
      return String(b.timestamp).localeCompare(String(a.timestamp));
    })
    .forEach((note) => {
      const li = document.createElement("li");
      li.className = `it-note-item${note.priority === "urgent" ? " urgent" : ""}`;
      li.dataset.noteId = note.id;

      const priorityLabel = note.priority === "urgent" ? "🚨 URGENT" : "Normal";
      li.innerHTML = `
        <div class="it-note-header">
          <span class="it-note-author">${note.authorName || note.author} (${note.authorRole || "member"})</span>
          <span class="it-note-priority">${priorityLabel}</span>
          <span class="it-note-time">${formatDateTime(note.timestamp)}</span>
        </div>
        <p class="it-note-msg">${note.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        <button class="it-note-resolve" data-note-id="${note.id}" type="button">✓ Mark resolved</button>
      `;
      list.appendChild(li);
    });

  list.addEventListener("click", (e) => {
    if (!(e.target instanceof HTMLButtonElement) || !e.target.dataset.noteId) return;
    const id = e.target.dataset.noteId;
    const all = readNotes();
    const idx = all.findIndex((n) => String(n.id) === String(id));
    if (idx !== -1) {
      all[idx].resolved = true;
      writeNotes(all);
    }
    renderITNotes();
  }, { once: true });
};

// Note submit form
const submitNoteForm = document.getElementById("submitNoteForm");
const submitNoteMessage = document.getElementById("submitNoteMessage");

if (submitNoteForm) {
  submitNoteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = String(document.getElementById("noteMessage")?.value || "").trim();
    const pri = String(document.getElementById("notePriority")?.value || "normal");

    if (!msg) {
      if (submitNoteMessage) {
        submitNoteMessage.textContent = "Please write a message before submitting.";
        submitNoteMessage.classList.remove("success");
      }
      return;
    }

    const spotPreset = USER_SPOTLIGHT_PRESETS[profileKey] || { name: currentUser.username, role: isAdmin ? "Admin" : "Member" };
    const note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author:     currentUser.username,
      authorName: spotPreset.name || currentUser.username,
      authorRole: spotPreset.role || (isAdmin ? "Admin" : "Member"),
      timestamp:  new Date().toISOString(),
      message:    msg,
      priority:   pri,
      resolved:   false,
    };

    writeNotes([...readNotes(), note]);
    submitNoteForm.reset();

    if (submitNoteMessage) {
      submitNoteMessage.textContent = "Note submitted. The IT team will be notified.";
      submitNoteMessage.classList.add("success");
      setTimeout(() => { submitNoteMessage.textContent = ""; submitNoteMessage.classList.remove("success"); }, 4000);
    }

    if (isAdmin) renderITNotes();
  });
}

// ═══════════════════════════════════════════════════════════════
//  TYPEWRITER WELCOME SEQUENCE
// ═══════════════════════════════════════════════════════════════
const displayName = WELCOME_NAMES[profileKey] || currentUser.username;
const spotPresetForWelcome = USER_SPOTLIGHT_PRESETS[profileKey] || {
  name: displayName,
  role: isAdmin ? "Admin" : "Member",
  photo: "assets/imperium mun logo.jpg",
};

if (dwhPhoto) {
  dwhPhoto.src = spotPresetForWelcome.photo;
  dwhPhoto.alt = `${spotPresetForWelcome.name} profile`;
}
if (dwhRoleEl) {
  dwhRoleEl.textContent = spotPresetForWelcome.role;
}

const typeText = (el, text, speed = 52) =>
  new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      if (i <= text.length) {
        el.textContent = text.slice(0, i);
        i++;
        setTimeout(tick, speed);
      } else {
        resolve();
      }
    };
    tick();
  });

const addBriefLine = (text) => {
  if (!dwhBriefing) return Promise.resolve();
  const line    = document.createElement("div");
  line.className = "dwh-brief-line";

  const prompt  = document.createElement("span");
  prompt.className = "dwh-prompt";
  prompt.textContent = "▸";

  const textEl  = document.createElement("span");
  textEl.className = "dwh-brief-text";

  const cur     = document.createElement("span");
  cur.className  = "dwh-brief-cursor";
  cur.setAttribute("aria-hidden", "true");
  cur.textContent = "│";

  line.appendChild(prompt);
  line.appendChild(textEl);
  line.appendChild(cur);
  dwhBriefing.appendChild(line);

  requestAnimationFrame(() => line.classList.add("is-visible"));
  return typeText(textEl, text, 28).then(() => { cur.style.display = "none"; });
};

const runWelcomeSequence = async () => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (dwhNameEl) {
    if (prefersReduced) {
      dwhNameEl.textContent = displayName;
      if (dwhCursor) dwhCursor.style.display = "none";
    } else {
      await new Promise((r) => setTimeout(r, 380));
      await typeText(dwhNameEl, displayName, 62);
      if (dwhCursor) dwhCursor.style.display = "none";
    }
  }

  if (prefersReduced) return;

  await new Promise((r) => setTimeout(r, 260));

  const pendingCount = readNotes().filter((n) => !n.resolved).length;
  const lastLoginStr = (() => {
    try {
      const sessions = JSON.parse(localStorage.getItem("imperium_active_users") || "{}");
      const s = sessions[profileKey];
      if (s && s.lastSeenAt) {
        return new Date(s.lastSeenAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      }
    } catch { /* */ }
    return null;
  })();

  const briefLines = [
    "Portal online. All systems nominal.",
    lastLoginStr ? `Last active session: ${lastLoginStr}.` : "Welcome back to the Imperium MUN portal.",
    pendingCount > 0
      ? `${pendingCount} staff note${pendingCount === 1 ? "" : "s"} pending — check the IT board below.`
      : "No pending staff notes. All clear.",
  ];

  for (const line of briefLines) {
    await new Promise((r) => setTimeout(r, 200));
    await addBriefLine(line);
  }
};

runWelcomeSequence();

// legacy no-op
const renderUserSpotlight = () => {};
renderUserSpotlight();

const showLogoutTransition = () => {
  const preset = USER_SPOTLIGHT_PRESETS[profileKey] || {
    name: currentUser.username,
    photo: "assets/imperium mun logo.jpg",
  };

  const overlay = document.createElement("div");
  overlay.className = "logout-overlay";
  overlay.innerHTML = `
    <div class="logout-card">
      <div class="logout-photo-ring">
        <img src="${preset.photo}" alt="" class="logout-photo" />
      </div>
      <p class="logout-name">${preset.name}</p>
      <p class="logout-msg">Goodbye. See you next time.</p>
      <p class="logout-msg" style="font-size:0.8rem;opacity:0.45;margin-top:0.1rem;">Securing session…</p>
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
      opacity: 0, duration: 0.4, ease: "power2.in", delay: 1.45,
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

logoutBtn.addEventListener("click", () => {
  logoutBtn.classList.add("is-loading");
  logoutBtn.disabled = true;
  showLogoutTransition();
  // redirect is handled inside showLogoutTransition via GSAP or setTimeout fallback
});

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
  return fetchViewLogsRemote();
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
  if (!adminPanel || !activeUsersList || !addUserForm || !addUserMessage || !siteSettingsForm) {
    return;
  }

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
    // Only re-populate fields from storage when the form is not actively being edited,
    // so the interval doesn't reset inputs while the user is typing.
    const formHasFocus = siteSettingsForm.contains(document.activeElement);
    if (!formHasFocus) {
      const settings = window.ImperiumAuth.getSiteSettings();
      maintenanceModeInput.value = settings.maintenanceMode ? "on" : "off";
      maintenanceMessageInput.value = String(settings.maintenanceMessage || "");
      launchDateInput.value = toDateTimeLocalValue(settings.launchDate);
      announcementInput.value = String(settings.announcement || "");
    }

    if (!isSiteSettingsHandlerBound) {
      const doSave = () => {
        const updateResult = window.ImperiumAuth.updateSiteSettings(currentUser, {
          maintenanceMode: maintenanceModeInput.value === "on",
          maintenanceMessage: String(maintenanceMessageInput.value || "").trim(),
          launchDate: fromDateTimeLocalValue(String(launchDateInput.value || "").trim()),
          announcement: String(announcementInput.value || "").trim(),
        });
        siteSettingsMessage.classList.toggle("success", updateResult.success);
        siteSettingsMessage.textContent = updateResult.message;
        return updateResult;
      };

      // Auto-save when any field changes (so toggling maintenance mode takes
      // effect immediately without needing to click the Save button).
      siteSettingsForm.addEventListener("change", doSave);

      // Also allow explicit Save button click.
      siteSettingsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        doSave();
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

    const activeUsers = window.ImperiumAuth.getActiveUsers();

    users.forEach((user) => {
      const li = document.createElement("li");
      const status = user.disabled ? "Disabled" : "Active";
      const photoSrc = user.photo || "assets/imperium mun logo.jpg";
      const photoHtml = `<img src="${photoSrc}" alt="${user.name || user.username}" class="uac-photo" loading="lazy" decoding="async" />`;
      const isActiveSelf = String(user.username || "").toLowerCase() === String(currentUser.username || "").toLowerCase();
      const isOnline = Object.keys(activeUsers).some((k) => k.toLowerCase() === String(user.username || "").toLowerCase());

      li.className = "uac-user-item";
      li.innerHTML = `
        ${photoHtml}
        <div class="uac-info">
          <p class="uac-name">${user.name || "—"} ${isOnline ? '<span class="uac-online-dot" title="Currently online"></span>' : ""}</p>
          <p class="uac-detail"><span class="uac-label">Username:</span> ${user.username}</p>
          <p class="uac-detail"><span class="uac-label">Password:</span> ${user.password}</p>
          <p class="uac-detail"><span class="uac-label">Role:</span> ${user.role}</p>
          <p class="uac-detail"><span class="uac-label">Status:</span> ${status}</p>
        </div>
        <div class="uac-actions">
          <button class="mini-btn" data-user="${user.username}" data-disabled="${user.disabled ? "1" : "0"}" data-action="toggle" type="button" ${user.username === "admin" ? "disabled" : ""}>
            ${user.disabled ? "Enable" : "Disable"}
          </button>
          <button class="mini-btn mini-btn--danger" data-user="${user.username}" data-action="force-logout" type="button" ${(!isOnline || isActiveSelf) ? "disabled" : ""} title="End this user's session">
            Force Logout
          </button>
        </div>
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
        const action = target.getAttribute("data-action") || "toggle";
        let result;

        if (action === "force-logout") {
          result = window.ImperiumAuth.forceLogoutUser(currentUser, username);
        } else {
          const disabledFlag = target.getAttribute("data-disabled") === "1";
          result = window.ImperiumAuth.setUserDisabled(currentUser, username, !disabledFlag);
        }

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

  if (isAdmin) renderITNotes();
};

  renderAnalytics();
renderAdminPanel();
renderInstagramStatsPanel();
if (isAdmin) renderITNotes();

// Re-render notes whenever storage changes (e.g. another tab submits a note)
window.addEventListener("storage", (ev) => {
  if (ev.key === NOTES_KEY && isAdmin) renderITNotes();
});

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

// ── Lines of Code counter ────────────────────────────────────────
(async () => {
  const el = document.getElementById("totalLines");
  if (!el) return;

  const files = [
    "index.html", "styles.css", "script.js", "tracker.js", "auth.js",
    "dashboard.html", "dashboard.css", "dashboard.js",
    "access.html", "access.css", "access.js",
    "applications.html", "applications.js",
    "waitlist.html", "waitlist.js",
    "netlify/functions/analytics.js", "netlify/functions/waitlist.js",
  ];

  const base = window.location.origin + window.location.pathname.replace(/[^/]+$/, "");
  try {
    const counts = await Promise.all(
      files.map(f =>
        fetch(base + f, { cache: "no-store" })
          .then(r => r.ok ? r.text() : null)
          .then(txt => (txt && txt.trim()) ? txt.split("\n").length : null)
          .catch(() => null)
      )
    );
    const valid = counts.filter(n => n !== null);
    const total = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : 0;
    el.textContent = total > 0 ? total.toLocaleString() : "\u2014";
  } catch {
    el.textContent = "—";
  }
})();
// ═══════════════════════════════════════════════════════════════
(function initDashGSAP() {
  if (typeof gsap === "undefined") return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Fade body in on load
  document.body.style.opacity = "0";
  requestAnimationFrame(() => {
    gsap.to(document.body, { opacity: 1, duration: 0.55, ease: "power2.out" });
  });

  if (!prefersReduced) {
    const header      = document.querySelector(".dash-header");
    const hero        = document.getElementById("dashWelcomeHero");
    const noteSection = document.getElementById("submitNoteSection");
    const sections    = document.querySelectorAll(".dash-main > .section");
    const statCards   = document.querySelectorAll(".stat-card");
    const tableCards  = document.querySelectorAll(".table-card");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (header)       tl.from(header,       { y: -22, opacity: 0, duration: 0.5 }, 0);
    if (hero)         tl.from(hero,         { y: 36, opacity: 0, scale: 0.97, duration: 0.78, ease: "power4.out" }, 0.12);
    if (noteSection)  tl.from(noteSection,  { y: 24, opacity: 0, duration: 0.6 }, 0.3);
    if (sections.length)  tl.from(sections,  { y: 28, opacity: 0, stagger: 0.1,  duration: 0.6 }, 0.3);
    if (statCards.length)  tl.from(statCards,  { y: 26, opacity: 0, scale: 0.93, stagger: 0.08, duration: 0.58, ease: "back.out(1.7)" }, 0.5);
    if (tableCards.length) tl.from(tableCards, { y: 22, opacity: 0, stagger: 0.07, duration: 0.55 }, 0.58);
  }

  // Page exit transitions for header nav links
  document.querySelectorAll(".dash-header a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    link.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      gsap.to(document.body, {
        opacity: 0, duration: 0.3, ease: "power2.in",
        onComplete: () => { window.location.href = href; },
      });
    });
  });
})();

