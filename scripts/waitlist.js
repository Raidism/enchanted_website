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
const accessNotice = document.getElementById("accessNotice");
const logoutBtn = document.getElementById("logoutBtn");
const waitlistTotal = document.getElementById("waitlistTotal");
const delegateCount = document.getElementById("delegateCount");
const teamRoleCount = document.getElementById("teamRoleCount");
const waitlistTableBody = document.getElementById("waitlistTableBody");
const deletedWaitlistBody = document.getElementById("deletedWaitlistBody");
const waitlistTrendChart = document.getElementById("waitlistTrendChart");
const waitlistTrendEmpty = document.getElementById("waitlistTrendEmpty");

const WAITLIST_KEY = "imperium_waitlist";
const WAITLIST_DELETED_KEY = "imperium_waitlist_deleted";
const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");
const WAITLIST_API_URL = `${API_BASE}/waitlist`;
const STATUS_LABELS = {
  pending: "Pending ⏳",
  green: "Green Light ✅",
  red: "Red Light ❌",
  saved: "Saved ⭐",
};

const isAdmin = currentUser.role === "admin";
const _profileKey = String(currentUser.username || "").trim().toLowerCase();
const hasDaModerationAccess = _profileKey === "omaralhomran";
const canModerateWaitlist = isAdmin || hasDaModerationAccess;
const _ROLE_LABELS = {
  admin:          "Head of IT",
  "ln-obidat":    "Under Secretary General",
  ahmadph:        "Secretary General",
  toleenkmedia:   "Head of Media",
  omaralhomran:   "Head of DA",
};
const _displayName = currentUser.name || currentUser.username;
const _roleLabel = _ROLE_LABELS[_profileKey] || (isAdmin ? "Admin" : "Member");

// Populate mini hero
const _pmhPhoto = document.getElementById("pmhPhoto");
const _pmhName  = document.getElementById("pmhName");
const _pmhRole  = document.getElementById("pmhRole");
if (_pmhPhoto && currentUser.photo) { _pmhPhoto.src = currentUser.photo; _pmhPhoto.alt = _displayName; }
if (_pmhName)  _pmhName.textContent  = _displayName;
if (_pmhRole)  _pmhRole.textContent  = _roleLabel;

if (!canModerateWaitlist && accessNotice) {
  accessNotice.textContent = "Protected view: personal details are masked and actions are read-only for member accounts.";
}

if (!isAdmin) {
  const adminLinks = document.querySelectorAll("[data-admin-link]");
  adminLinks.forEach((link) => {
    link.classList.add("locked-link");
    link.setAttribute("aria-disabled", "true");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const href = String(link.getAttribute("href") || "").toLowerCase();
      const feature = href.includes("ops") ? "ops" : (href.includes("settings") ? "settings" : "restricted");
      window.location.href = `locked.html?feature=${encodeURIComponent(feature)}&from=waitlist.html`;
    });
  });
}

let previousRenderedIds = new Set();
let activeAction = null;

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
      <p class="logout-name">${_displayName}</p>
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
      onComplete: () => { window.ImperiumAuth.logout(); window.location.href = "access.html"; } });
  } else {
    setTimeout(() => { window.ImperiumAuth.logout(); window.location.href = "access.html"; }, 1600);
  }
});

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

const readDeletedLocal = () => {
  try {
    const raw = localStorage.getItem(WAITLIST_DELETED_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeDeletedLocal = (rows) => {
  localStorage.setItem(WAITLIST_DELETED_KEY, JSON.stringify(rows.slice(0, 500)));
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

  return {
    entries: payload.entries,
    deletedEntries: Array.isArray(payload.deletedEntries) ? payload.deletedEntries : [],
  };
};

const updateWaitlistRemote = async ({ action, id, status }) => {
  const response = await fetch(WAITLIST_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      id,
      status,
      reviewedBy: currentUser.username,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    const message = payload && payload.message ? payload.message : "Failed to update entry.";
    throw new Error(message);
  }

  return {
    entries: Array.isArray(payload.entries) ? payload.entries : [],
    deletedEntries: Array.isArray(payload.deletedEntries) ? payload.deletedEntries : [],
  };
};

const getWaitlistRows = async () => {
  try {
    const remotePayload = await fetchWaitlistRemote();
    writeWaitlistLocal(remotePayload.entries);
    writeDeletedLocal(remotePayload.deletedEntries);
    return remotePayload;
  } catch {
    return {
      entries: readWaitlistLocal(),
      deletedEntries: readDeletedLocal(),
    };
  }
};

const updateLocalStatus = (rows, id, nextStatus) => rows.map((entry) => {
  if (String(entry.id || "") !== id) {
    return entry;
  }

  return {
    ...entry,
    status: nextStatus,
    reviewedAt: new Date().toISOString(),
    reviewedBy: currentUser.username,
  };
});

const deleteLocalEntry = (rows, id) => rows.filter((entry) => String(entry.id || "") !== id);

const moveToDeletedLocal = (entries, deletedEntries, id) => {
  const removed = entries.find((entry) => String(entry.id || "") === id);
  const nextEntries = deleteLocalEntry(entries, id);
  if (!removed) {
    return {
      entries: nextEntries,
      deletedEntries,
    };
  }

  return {
    entries: nextEntries,
    deletedEntries: [{
      ...removed,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser.username,
    }, ...deletedEntries],
  };
};

const restoreLocalEntry = (entries, deletedEntries, id) => {
  const restored = deletedEntries.find((entry) => String(entry.id || "") === id);
  const nextDeleted = deletedEntries.filter((entry) => String(entry.id || "") !== id);
  if (!restored) {
    return {
      entries,
      deletedEntries: nextDeleted,
    };
  }

  return {
    entries: [{
      ...restored,
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentUser.username,
    }, ...entries],
    deletedEntries: nextDeleted,
  };
};

const formatDateTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
};

const maskValue = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "******";
  }
  return "*".repeat(Math.max(6, Math.min(18, text.length)));
};

const formatRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  const labels = {
    delegate: "Delegate",
    chair: "Chair",
    "volunteering-team": "Volunteering Team",
    "security-team": "Security Team",
    "press-team": "Press Team",
    "sponsors-partnerships": "Sponsors and Partnerships",
  };

  return labels[raw] || value || "Unknown";
};

const renderWaitlistTrend = (rows) => {
  if (!waitlistTrendChart) return;

  const byDate = rows.reduce((acc, row) => {
    const d = new Date(String(row.addedAt || ""));
    if (Number.isNaN(d.getTime())) return acc;
    const key = d.toISOString().slice(0, 10);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const points = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-10);

  if (!points.length) {
    waitlistTrendChart.innerHTML = "";
    if (waitlistTrendEmpty) waitlistTrendEmpty.hidden = false;
    return;
  }

  if (waitlistTrendEmpty) waitlistTrendEmpty.hidden = true;

  const width = 600;
  const height = 180;
  const left = 40;
  const top = 20;
  const chartW = 530;
  const chartH = 120;
  const bottom = top + chartH;
  const maxVal = Math.max(1, ...points.map(([, count]) => count));
  const stepX = points.length > 1 ? chartW / (points.length - 1) : 0;

  const coords = points.map(([day, count], idx) => {
    const x = left + idx * stepX;
    const y = bottom - (count / maxVal) * chartH;
    return { day: day.slice(5), count, x, y };
  });

  const polyline = coords.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
  const dots = coords.map((p) => `
    <circle cx="${Math.round(p.x)}" cy="${Math.round(p.y)}" r="4.5" fill="#d5b465"></circle>
    <text x="${Math.round(p.x)}" y="${Math.round(p.y) - 10}" text-anchor="middle" font-size="10" fill="#f0daa0">${p.count}</text>
    <text x="${Math.round(p.x)}" y="${bottom + 14}" text-anchor="middle" font-size="10" fill="#9eb0a3">${p.day}</text>
  `).join("");

  waitlistTrendChart.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="rgba(8,14,10,0.7)"></rect>
    <line x1="${left}" y1="${bottom}" x2="${left + chartW}" y2="${bottom}" stroke="rgba(213,180,101,0.35)" stroke-width="1"></line>
    <polyline points="${polyline}" fill="none" stroke="rgba(77,139,99,0.95)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${dots}
  `;
};

const renderWaitlist = async () => {
  const payload = await getWaitlistRows();
  const rows = Array.isArray(payload.entries) ? payload.entries : [];
  const deletedRows = Array.isArray(payload.deletedEntries) ? payload.deletedEntries : [];
  const sorted = [...rows].sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));
  const deletedSorted = [...deletedRows]
    .sort((a, b) => String(b.deletedAt || "").localeCompare(String(a.deletedAt || "")))
    .slice(0, 40);

  waitlistTotal.textContent = String(sorted.length);
  delegateCount.textContent = String(sorted.filter((entry) => String(entry.role || "") === "delegate").length);
  teamRoleCount.textContent = String(
    sorted.filter((entry) => {
      const role = String(entry.role || "");
      return role !== "delegate";
    }).length
  );

  waitlistTableBody.innerHTML = "";
  if (sorted.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="7">No early access submissions yet.</td>';
    waitlistTableBody.appendChild(row);
  } else {
    sorted.slice(0, 200).forEach((entry) => {
      const row = document.createElement("tr");
      row.setAttribute("data-entry-id", String(entry.id || ""));

      const name = canModerateWaitlist ? (entry.name || "Unknown") : maskValue(entry.name);
      const email = canModerateWaitlist ? (entry.email || "Unknown") : maskValue(entry.email);
      const school = canModerateWaitlist ? (entry.school || "Unknown") : maskValue(entry.school);

      const statusKey = String(entry.status || "pending");

      row.innerHTML = `
        <td>${formatDateTime(entry.addedAt)}</td>
        <td>${name}</td>
        <td>${email}</td>
        <td>${school}</td>
        <td>${formatRole(entry.role)}</td>
        <td><span class="status-pill ${statusKey}">${STATUS_LABELS[statusKey] || STATUS_LABELS.pending}</span></td>
        <td>
            ${canModerateWaitlist
      ? `<div class="entry-actions">
            <button class="action-emoji-btn" type="button" data-action="green" data-id="${entry.id}" title="Green Light">✅</button>
            <button class="action-emoji-btn" type="button" data-action="red" data-id="${entry.id}" title="Red Light">❌</button>
            <button class="action-emoji-btn" type="button" data-action="saved" data-id="${entry.id}" title="Save Application">⭐</button>
            <button class="action-emoji-btn" type="button" data-action="delete" data-id="${entry.id}" title="Delete Application">🗑️</button>
          </div>`
      : `<span class="sub">View only</span>`}
        </td>
      `;

      if (!previousRenderedIds.has(String(entry.id || ""))) {
        row.classList.add("row-enter");
      }

      if (activeAction && activeAction.id === String(entry.id || "")) {
        if (activeAction.action === "delete") {
          row.classList.add("row-leave");
        } else {
          row.classList.add("row-updated");
        }
      }

      waitlistTableBody.appendChild(row);
    });
  }

  renderWaitlistTrend(sorted);

  previousRenderedIds = new Set(sorted.map((entry) => String(entry.id || "")));
  activeAction = null;

  if (!deletedWaitlistBody) {
    return;
  }

  deletedWaitlistBody.innerHTML = "";
  if (deletedSorted.length === 0) {
    const emptyDeletedRow = document.createElement("tr");
    emptyDeletedRow.innerHTML = '<td colspan="6">No deleted entries.</td>';
    deletedWaitlistBody.appendChild(emptyDeletedRow);
    return;
  }

  deletedSorted.forEach((entry) => {
    const row = document.createElement("tr");
    row.setAttribute("data-deleted-id", String(entry.id || ""));

    const name = canModerateWaitlist ? (entry.name || "Unknown") : maskValue(entry.name);
    const email = canModerateWaitlist ? (entry.email || "Unknown") : maskValue(entry.email);
    const school = canModerateWaitlist ? (entry.school || "Unknown") : maskValue(entry.school);

    row.innerHTML = `
      <td>${formatDateTime(entry.deletedAt)}</td>
      <td>${name}</td>
      <td>${email}</td>
      <td>${school}</td>
      <td>${formatRole(entry.role)}</td>
      <td>
        <button class="action-emoji-btn" type="button" data-action="restore" data-id="${entry.id}" title="Restore Entry">↩️</button>
      </td>
    `;

    deletedWaitlistBody.appendChild(row);
  });
};

waitlistTableBody.addEventListener("click", async (event) => {
  if (!canModerateWaitlist) {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = String(target.getAttribute("data-action") || "").trim();
  const id = String(target.getAttribute("data-id") || "").trim();
  if (!action || !id) {
    return;
  }

  const row = target.closest("tr");
  if (row) {
    row.classList.add("row-working");
  }

  target.disabled = true;
  target.classList.add("is-busy");

  try {
    if (action === "delete") {
      activeAction = { id, action };
      if (row) {
        row.classList.add("row-leave");
      }
      await new Promise((resolve) => setTimeout(resolve, 220));

      const remotePayload = await updateWaitlistRemote({ action: "delete", id });
      writeWaitlistLocal(remotePayload.entries);
      writeDeletedLocal(remotePayload.deletedEntries);
      await renderWaitlist();
      return;
    }

    const remotePayload = await updateWaitlistRemote({ action: "updateStatus", id, status: action });
    activeAction = { id, action };
    writeWaitlistLocal(remotePayload.entries);
    writeDeletedLocal(remotePayload.deletedEntries);
    await renderWaitlist();
  } catch {
    // Fallback to local-only state when remote API is unavailable.
    const rows = readWaitlistLocal();
    const deletedRows = readDeletedLocal();

    if (action === "delete") {
      activeAction = { id, action };
      const nextLocal = moveToDeletedLocal(rows, deletedRows, id);
      writeWaitlistLocal(nextLocal.entries);
      writeDeletedLocal(nextLocal.deletedEntries);
      await renderWaitlist();
      return;
    }

    const nextRows = updateLocalStatus(rows, id, action);
    activeAction = { id, action };
    writeWaitlistLocal(nextRows);
    writeDeletedLocal(deletedRows);
    await renderWaitlist();
  } finally {
    target.disabled = false;
    target.classList.remove("is-busy");
    if (row) {
      row.classList.remove("row-working");
    }
  }
});

if (deletedWaitlistBody) {
  deletedWaitlistBody.addEventListener("click", async (event) => {
    if (!canModerateWaitlist) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = String(target.getAttribute("data-action") || "").trim();
    const id = String(target.getAttribute("data-id") || "").trim();
    if (action !== "restore" || !id) {
      return;
    }

    target.disabled = true;
    target.classList.add("is-busy");

    try {
      const remotePayload = await updateWaitlistRemote({ action: "restore", id });
      activeAction = { id, action: "restore" };
      writeWaitlistLocal(remotePayload.entries);
      writeDeletedLocal(remotePayload.deletedEntries);
      await renderWaitlist();
    } catch {
      const rows = readWaitlistLocal();
      const deletedRows = readDeletedLocal();
      const nextLocal = restoreLocalEntry(rows, deletedRows, id);
      activeAction = { id, action: "restore" };
      writeWaitlistLocal(nextLocal.entries);
      writeDeletedLocal(nextLocal.deletedEntries);
      await renderWaitlist();
    } finally {
      target.disabled = false;
      target.classList.remove("is-busy");
    }
  });
}

renderWaitlist();
setInterval(renderWaitlist, 7000);
window.addEventListener("storage", (event) => {
  if (event.key === WAITLIST_KEY || event.key === WAITLIST_DELETED_KEY) {
    renderWaitlist();
  }
});

// GSAP entrance + page transitions
(function initWaitlistGSAP() {
  if (typeof gsap === "undefined") return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.body.style.opacity = "0";
  requestAnimationFrame(() => {
    gsap.to(document.body, { opacity: 1, duration: 0.55, ease: "power2.out" });
  });

  if (!prefersReduced) {
    const header     = document.querySelector(".dash-header");
    const hero       = document.getElementById("pageMiniHero");
    const section    = document.querySelector(".dash-main > .section");
    const statCards  = document.querySelectorAll(".stat-card");
    const tableCards = document.querySelectorAll(".table-card");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (header)      tl.from(header,      { y: -22, opacity: 0, duration: 0.5 }, 0);
    if (hero)        tl.from(hero,        { y: 34, opacity: 0, scale: 0.97, duration: 0.72, ease: "power4.out" }, 0.1);
    if (section)     tl.from(section,     { y: 26, opacity: 0, duration: 0.6 }, 0.26);
    if (statCards.length)  tl.from(statCards,  { y: 26, opacity: 0, scale: 0.93, stagger: 0.08, duration: 0.56, ease: "back.out(1.7)" }, 0.4);
    if (tableCards.length) tl.from(tableCards, { y: 22, opacity: 0, stagger: 0.07, duration: 0.55 }, 0.5);
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
