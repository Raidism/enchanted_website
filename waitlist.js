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

const WAITLIST_KEY = "imperium_waitlist";
const WAITLIST_API_URL = "/.netlify/functions/waitlist";
const STATUS_LABELS = {
  pending: "Pending ⏳",
  green: "Green Light ✅",
  red: "Red Light ❌",
  saved: "Saved ⭐",
};

const isAdmin = currentUser.role === "admin";
welcomeText.textContent = isAdmin ? "Welcome admin" : `Welcome ${currentUser.username}`;
if (!isAdmin && accessNotice) {
  accessNotice.textContent = "Protected view: personal details are masked for member accounts.";
}

logoutBtn.addEventListener("click", () => {
  logoutBtn.classList.add("is-loading");
  logoutBtn.disabled = true;

  setTimeout(() => {
    window.ImperiumAuth.logout();
    window.location.href = "access.html";
  }, 900);
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

  return Array.isArray(payload.entries) ? payload.entries : [];
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

const renderWaitlist = async () => {
  const rows = await getWaitlistRows();
  const sorted = [...rows].sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));

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
    return;
  }

  sorted.slice(0, 200).forEach((entry) => {
    const row = document.createElement("tr");

    const name = isAdmin ? (entry.name || "Unknown") : maskValue(entry.name);
    const email = isAdmin ? (entry.email || "Unknown") : maskValue(entry.email);
    const school = isAdmin ? (entry.school || "Unknown") : maskValue(entry.school);

    const statusKey = String(entry.status || "pending");

    row.innerHTML = `
      <td>${formatDateTime(entry.addedAt)}</td>
      <td>${name}</td>
      <td>${email}</td>
      <td>${school}</td>
      <td>${formatRole(entry.role)}</td>
      <td><span class="status-pill ${statusKey}">${STATUS_LABELS[statusKey] || STATUS_LABELS.pending}</span></td>
      <td>
        <div class="entry-actions">
          <button class="action-emoji-btn" type="button" data-action="green" data-id="${entry.id}" title="Green Light">✅</button>
          <button class="action-emoji-btn" type="button" data-action="red" data-id="${entry.id}" title="Red Light">❌</button>
          <button class="action-emoji-btn" type="button" data-action="saved" data-id="${entry.id}" title="Save Application">⭐</button>
          <button class="action-emoji-btn" type="button" data-action="delete" data-id="${entry.id}" title="Delete Application">🗑️</button>
        </div>
      </td>
    `;

    waitlistTableBody.appendChild(row);
  });
};

waitlistTableBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = String(target.getAttribute("data-action") || "").trim();
  const id = String(target.getAttribute("data-id") || "").trim();
  if (!action || !id) {
    return;
  }

  target.disabled = true;

  try {
    if (action === "delete") {
      const remoteRows = await updateWaitlistRemote({ action: "delete", id });
      writeWaitlistLocal(remoteRows);
      await renderWaitlist();
      return;
    }

    const remoteRows = await updateWaitlistRemote({ action: "updateStatus", id, status: action });
    writeWaitlistLocal(remoteRows);
    await renderWaitlist();
  } catch {
    // Fallback to local-only state when remote API is unavailable.
    const rows = readWaitlistLocal();
    const nextRows = action === "delete"
      ? deleteLocalEntry(rows, id)
      : updateLocalStatus(rows, id, action);

    writeWaitlistLocal(nextRows);
    await renderWaitlist();
  } finally {
    target.disabled = false;
  }
});

renderWaitlist();
setInterval(renderWaitlist, 7000);
window.addEventListener("storage", (event) => {
  if (event.key === WAITLIST_KEY) {
    renderWaitlist();
  }
});
