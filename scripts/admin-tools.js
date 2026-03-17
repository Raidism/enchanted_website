(function () {
  if (!window.ImperiumAuth) return;

  const currentUser = window.ImperiumAuth.getCurrentUser();
  if (!currentUser) {
    window.location.href = "/access";
    return;
  }

  const isAdmin = String(currentUser.role || "") === "admin";
  const profileKey = String(currentUser.username || "").trim().toLowerCase();
  const PROFILE_FALLBACKS = {
    joumohd08: {
      name: "Joumana Mohamed",
      photo: "assets/Joumana Mohamed .png",
    },
  };
  const profileFallback = PROFILE_FALLBACKS[profileKey] || {};
  const profileDisplayName = String(profileFallback.name || currentUser.name || currentUser.username || "User");
  const profilePhotoSrc = String(profileFallback.photo || currentUser.photo || "assets/imperium mun logo.jpg");

  window.ImperiumAuth.heartbeat();
  setInterval(() => window.ImperiumAuth.heartbeat(), 30000);

  const pmhPhoto = document.getElementById("pmhPhoto");
  const pmhName = document.getElementById("pmhName");
  const pmhRole = document.getElementById("pmhRole");
  const pmhHero = document.getElementById("pageMiniHero");
  if (pmhPhoto) {
    pmhPhoto.src = profilePhotoSrc;
    pmhPhoto.alt = profileDisplayName;
  }
  if (pmhName) pmhName.textContent = profileDisplayName;
  if (pmhRole) pmhRole.textContent = "Admin";
  if (pmhHero) {
    pmhHero.classList.remove("profile-pending");
    pmhHero.classList.add("profile-ready");
  }

  const opsCenter = document.getElementById("opsCenter");
  if (!opsCenter) return;
  opsCenter.hidden = !isAdmin;
  if (!isAdmin) {
    window.location.href = "/locked?feature=ops&from=dashboard";
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logoutBtn.classList.add("is-loading");
      logoutBtn.disabled = true;

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
        gsap.to(overlay, { opacity: 0, duration: 0.4, ease: "power2.in", delay: 1.45,
          onComplete: () => { window.ImperiumAuth.logout(); window.location.href = "/"; } });
      } else {
        setTimeout(() => { window.ImperiumAuth.logout(); window.location.href = "/"; }, 1600);
      }
    });
  }

  const WAITLIST_KEY = "imperium_waitlist";
  const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");
  const WAITLIST_API_URL = `${API_BASE}/waitlist`;
  const ANNOUNCEMENTS_KEY = "imperium_announcements";
  const SECRETARIAT_KEY = "imperium_secretariat";
  const ACTIVITY_KEY = "imperium_admin_activity";

  const eaSearchInput = document.getElementById("eaSearchInput");
  const eaSchoolFilter = document.getElementById("eaSchoolFilter");
  const eaInterestFilter = document.getElementById("eaInterestFilter");
  const eaTableBody = document.getElementById("eaTableBody");
  const eaLiveCount = document.getElementById("eaLiveCount");
  const eaExportBtn = document.getElementById("eaExportBtn");
  const eaNotifyAllBtn = document.getElementById("eaNotifyAllBtn");

  const launchOpsForm = document.getElementById("launchOpsForm");
  const applicationsOpenToggle = document.getElementById("applicationsOpenToggle");
  const launchDateOpsInput = document.getElementById("launchDateOpsInput");
  const conferenceDateInput = document.getElementById("conferenceDateInput");
  const locationTextInput = document.getElementById("locationTextInput");
  const conferenceDescriptionInput = document.getElementById("conferenceDescriptionInput");
  const countdownEnabledToggle = document.getElementById("countdownEnabledToggle");
  const notifyAllOnOpenToggle = document.getElementById("notifyAllOnOpenToggle");
  const launchOpsMessage = document.getElementById("launchOpsMessage");

  const maintenanceOpsForm = document.getElementById("maintenanceOpsForm");
  const maintenanceModeToggle = document.getElementById("maintenanceModeToggle");
  const maintenanceModeText = document.getElementById("maintenanceModeText");
  const maintenanceMessageInput = document.getElementById("maintenanceMessageInput");
  const maintenanceStatusBadge = document.getElementById("maintenanceStatusBadge");
  const maintenanceOpsMessage = document.getElementById("maintenanceOpsMessage");

  const announcementForm = document.getElementById("announcementForm");
  const announcementTitleInput = document.getElementById("announcementTitleInput");
  const announcementBodyInput = document.getElementById("announcementBodyInput");
  const announcementSendToggle = document.getElementById("announcementSendToggle");
  const announcementHistoryList = document.getElementById("announcementHistoryList");
  const announcementMessage = document.getElementById("announcementMessage");
  const clearAnnouncementsBtn = document.getElementById("clearAnnouncementsBtn");

  const secretariatForm = document.getElementById("secretariatForm");
  const secNameInput = document.getElementById("secNameInput");
  const secTitleInput = document.getElementById("secTitleInput");
  const secDescInput = document.getElementById("secDescInput");
  const secPhotoInput = document.getElementById("secPhotoInput");
  const secretariatList = document.getElementById("secretariatList");

  const opsAnalyticsList = document.getElementById("opsAnalyticsList");
  const activityLogList = document.getElementById("activityLogList");

  let waitlistRows = [];
  let autoSaveTimer = null;

  const toDateTimeLocalValue = (isoValue) => {
    const date = new Date(String(isoValue || ""));
    if (Number.isNaN(date.getTime())) return "";
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const fromDateTimeLocalValue = (localValue) => {
    const trimmed = String(localValue || "").trim();
    if (!trimmed) return "";
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  };

  const formatDateTime = (iso) => {
    const d = new Date(String(iso || ""));
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString();
  };

  const roleLabel = (value) => {
    const key = String(value || "").trim().toLowerCase();
    const labels = {
      delegate: "Delegate",
      chair: "Chair",
      "volunteering-team": "Volunteering Team",
      "security-team": "Security Team",
      "press-team": "Press Team",
      partnerships: "Partnerships",
      "sponsors-partnerships": "Partnerships",
    };
    return labels[key] || (value || "Unknown");
  };

  const readLocal = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  };

  const writeLocal = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const showToast = (message, success) => {
    let toast = document.getElementById("opsToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "opsToast";
      Object.assign(toast.style, {
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        zIndex: "12000",
        borderRadius: "10px",
        padding: "0.65rem 0.8rem",
        maxWidth: "360px",
        fontSize: "0.85rem",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        display: "none",
      });
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = "block";
    toast.style.background = success ? "rgba(71,130,95,0.95)" : "rgba(145,59,59,0.95)";
    toast.style.color = "#f4faf6";

    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toast.style.display = "none";
    }, 2200);
  };

  const logActivity = (message) => {
    const rows = readLocal(ACTIVITY_KEY, []);
    rows.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message,
      actor: currentUser.username,
      at: new Date().toISOString(),
    });
    writeLocal(ACTIVITY_KEY, rows.slice(0, 300));
    renderActivityLog();
  };

  const renderActivityLog = () => {
    if (!activityLogList) return;
    const rows = readLocal(ACTIVITY_KEY, []);
    activityLogList.innerHTML = "";
    if (!rows.length) {
      const li = document.createElement("li");
      li.textContent = "No activity yet.";
      activityLogList.appendChild(li);
      return;
    }

    rows.slice(0, 30).forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${item.actor}</strong> — ${item.message}<div class="ops-note">${formatDateTime(item.at)}</div>`;
      activityLogList.appendChild(li);
    });
  };

  const fetchWaitlistRows = async () => {
    try {
      const response = await fetch(WAITLIST_API_URL, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error("Failed");
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.entries)) throw new Error("Invalid payload");
      waitlistRows = payload.entries;
      writeLocal(WAITLIST_KEY, waitlistRows);
      return waitlistRows;
    } catch {
      waitlistRows = readLocal(WAITLIST_KEY, []);
      return waitlistRows;
    }
  };

  const postWaitlistAction = async (payload) => {
    const response = await fetch(WAITLIST_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, reviewedBy: currentUser.username }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Waitlist update failed.");
    }
    if (Array.isArray(data.entries)) {
      waitlistRows = data.entries;
      writeLocal(WAITLIST_KEY, waitlistRows);
    }
    return data;
  };

  const getFilteredRows = () => {
    const q = String(eaSearchInput && eaSearchInput.value || "").trim().toLowerCase();
    const school = String(eaSchoolFilter && eaSchoolFilter.value || "all");
    const interest = String(eaInterestFilter && eaInterestFilter.value || "all");

    return waitlistRows.filter((row) => {
      const name = String(row.name || "").toLowerCase();
      const email = String(row.email || "").toLowerCase();
      const schoolText = String(row.school || "");
      const schoolLower = schoolText.toLowerCase();
      const role = String(row.role || "delegate");

      if (school !== "all" && schoolText !== school) return false;
      if (interest !== "all" && role !== interest) return false;
      if (!q) return true;
      return name.includes(q) || email.includes(q) || schoolLower.includes(q);
    });
  };

  const updateFilterOptions = () => {
    if (!eaSchoolFilter || !eaInterestFilter) return;

    const schoolValue = eaSchoolFilter.value || "all";
    const interestValue = eaInterestFilter.value || "all";

    const schools = [...new Set(waitlistRows.map((r) => String(r.school || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    const interests = [...new Set(waitlistRows.map((r) => String(r.role || "delegate").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    eaSchoolFilter.innerHTML = '<option value="all">All Schools</option>' + schools.map((s) => `<option value="${s.replace(/"/g, "&quot;")}">${s}</option>`).join("");
    eaInterestFilter.innerHTML = '<option value="all">All Interests</option>' + interests.map((r) => `<option value="${r}">${roleLabel(r)}</option>`).join("");

    eaSchoolFilter.value = schools.includes(schoolValue) ? schoolValue : "all";
    eaInterestFilter.value = interests.includes(interestValue) ? interestValue : "all";
  };

  const renderOpsAnalytics = () => {
    if (!opsAnalyticsList) return;
    opsAnalyticsList.innerHTML = "";

    const total = waitlistRows.length;
    const now = Date.now();
    const last24 = waitlistRows.filter((r) => {
      const t = new Date(String(r.addedAt || "")).getTime();
      return !Number.isNaN(t) && now - t <= 24 * 60 * 60 * 1000;
    }).length;

    const schoolMap = waitlistRows.reduce((acc, row) => {
      const key = String(row.school || "Unknown").trim() || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topSchools = Object.entries(schoolMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ") || "None";

    const interestMap = waitlistRows.reduce((acc, row) => {
      const key = String(row.role || "delegate");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const interestDistribution = Object.entries(interestMap)
      .sort((a, b) => b[1] - a[1])
      .map(([role, count]) => `${roleLabel(role)}: ${count}`)
      .join(" | ") || "No interest data";

    const byDate = waitlistRows.reduce((acc, row) => {
      const d = new Date(String(row.addedAt || ""));
      if (Number.isNaN(d.getTime())) return acc;
      const key = d.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const growth = Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([day, count]) => `${day.slice(5)}: ${count}`)
      .join(" | ") || "No growth data";

    const growthRows = Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10);

    [
      `Total early access signups: ${total}`,
      `Signups in last 24 hours: ${last24}`,
      `Most common schools: ${topSchools}`,
      `Interest distribution: ${interestDistribution}`,
      `Growth over time (last 7 days): ${growth}`,
    ].forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      opsAnalyticsList.appendChild(li);
    });

    const chart = document.getElementById("opsGrowthChart");
    if (chart) {
      if (!growthRows.length) {
        chart.innerHTML = "";
        return;
      }

      const width = 600;
      const height = 180;
      const left = 40;
      const top = 20;
      const chartW = 530;
      const chartH = 120;
      const bottom = top + chartH;
      const maxVal = Math.max(1, ...growthRows.map((row) => row[1]));
      const stepX = growthRows.length > 1 ? chartW / (growthRows.length - 1) : 0;

      const coords = growthRows.map(([day, count], idx) => {
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

      chart.innerHTML = `
        <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="rgba(8,14,10,0.7)"></rect>
        <line x1="${left}" y1="${bottom}" x2="${left + chartW}" y2="${bottom}" stroke="rgba(213,180,101,0.35)" stroke-width="1"></line>
        <polyline points="${polyline}" fill="none" stroke="rgba(77,139,99,0.95)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${dots}
      `;
    }
  };

  const renderWaitlistTable = () => {
    if (!eaTableBody) return;

    updateFilterOptions();
    const rows = getFilteredRows()
      .slice()
      .sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));

    eaTableBody.innerHTML = "";
    if (eaLiveCount) eaLiveCount.textContent = String(waitlistRows.length);

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="7">No entries match the current filter.</td>';
      eaTableBody.appendChild(tr);
      return;
    }

    rows.slice(0, 500).forEach((row) => {
      const tr = document.createElement("tr");
      const notifiedText = row.notified ? `Yes (${formatDateTime(row.notifiedAt)})` : "No";
      tr.innerHTML = `
        <td>${formatDateTime(row.addedAt)}</td>
        <td>${String(row.name || "Unknown")}</td>
        <td>${String(row.email || "Unknown")}</td>
        <td>${String(row.school || "Unknown")}</td>
        <td>${roleLabel(row.role)}</td>
        <td>${notifiedText}</td>
        <td>
          <button type="button" data-action="toggle-notified" data-id="${String(row.id || "")}">${row.notified ? "Unmark" : "Mark"}</button>
          <button type="button" data-action="delete" data-id="${String(row.id || "")}">Delete</button>
        </td>
      `;
      eaTableBody.appendChild(tr);
    });

    renderOpsAnalytics();
  };

  const exportRowsToCsv = () => {
    const rows = getFilteredRows();
    const header = ["name", "email", "school", "interest", "signupDate", "notified", "notifiedAt"];
    const csvRows = [header.join(",")];

    rows.forEach((row) => {
      const values = [
        row.name,
        row.email,
        row.school,
        roleLabel(row.role),
        row.addedAt,
        row.notified ? "yes" : "no",
        row.notifiedAt || "",
      ].map((value) => `"${String(value || "").replace(/"/g, '""')}"`);
      csvRows.push(values.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "early-access-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    logActivity(`Exported CSV (${rows.length} rows)`);
    showToast("CSV exported.", true);
  };

  const markAllNotified = async () => {
    try {
      await postWaitlistAction({ action: "notifyAll" });
      logActivity("Marked all early access students as notified");
      showToast("All students marked as notified.", true);
      renderWaitlistTable();
    } catch (error) {
      waitlistRows = waitlistRows.map((row) => ({ ...row, notified: true, notifiedAt: new Date().toISOString() }));
      writeLocal(WAITLIST_KEY, waitlistRows);
      showToast(`Saved locally: ${String(error.message || "offline")}`, false);
      renderWaitlistTable();
    }
  };

  const getAnnouncements = () => readLocal(ANNOUNCEMENTS_KEY, []);

  const syncWebsiteAnnouncement = (rows) => {
    const items = Array.isArray(rows) ? rows : getAnnouncements();
    const latest = items.length ? (items[0].title ? `${items[0].title}: ${items[0].body}` : items[0].body).trim() : "";
    const result = window.ImperiumAuth.updateSiteSettings(currentUser, { announcement: latest });
    return result;
  };

  const renderAnnouncements = () => {
    if (!announcementHistoryList) return;
    const rows = getAnnouncements();
    announcementHistoryList.innerHTML = "";

    if (!rows.length) {
      const li = document.createElement("li");
      li.textContent = "No announcements yet.";
      announcementHistoryList.appendChild(li);
      return;
    }

    rows.slice(0, 20).forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${item.title}</strong><div>${item.body}</div><div class="ops-note">${formatDateTime(item.createdAt)} by ${item.author}</div>`;

      const actions = document.createElement("div");
      actions.className = "ops-item-actions";

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        if (!window.confirm("Delete this announcement?")) return;
        const next = getAnnouncements().filter((entry) => entry.id !== item.id);
        writeLocal(ANNOUNCEMENTS_KEY, next);
        const sync = syncWebsiteAnnouncement(next);
        renderAnnouncements();
        logActivity(`Deleted announcement: ${item.title}`);
        if (!sync.success) {
          showToast(String(sync.message || "Failed to sync announcement state."), false);
        }
      });

      actions.appendChild(delBtn);
      li.appendChild(actions);
      announcementHistoryList.appendChild(li);
    });
  };

  const defaultSecretariat = [
    {
      id: "sg",
      name: "Ahmed Pharaon",
      title: "Secretary-General (SG)",
      description: "Leads the vision and direction of Imperium MUN.",
      photo: "assets/secretary general.png",
    },
    {
      id: "dsg",
      name: "Fahad Albulaihid",
      title: "Deputy Secretary-General (DSG)",
      description: "Supports operations and committee coordination.",
      photo: "assets/deputy secretary general.png",
    },
    {
      id: "usg",
      name: "Leen Obeidat",
      title: "Under Secretary-General (USG)",
      description: "Oversees programs and organizer readiness.",
      photo: "assets/under secretary general.png",
    },
  ];

  const getSecretariat = () => {
    const rows = readLocal(SECRETARIAT_KEY, null);
    if (!Array.isArray(rows) || !rows.length) {
      writeLocal(SECRETARIAT_KEY, defaultSecretariat);
      return defaultSecretariat;
    }
    return rows;
  };

  const saveSecretariat = (rows) => {
    writeLocal(SECRETARIAT_KEY, rows);
    renderSecretariat();
  };

  const renderSecretariat = () => {
    if (!secretariatList) return;
    const rows = getSecretariat();
    secretariatList.innerHTML = "";

    rows.forEach((member, index) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${member.name}</strong><div>${member.title}</div><div class="ops-note">${member.description}</div>`;

      const actions = document.createElement("div");
      actions.className = "ops-item-actions";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.textContent = "Up";
      upBtn.disabled = index === 0;
      upBtn.addEventListener("click", () => {
        const next = rows.slice();
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        saveSecretariat(next);
        logActivity(`Reordered secretariat member: ${member.name}`);
      });

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.textContent = "Down";
      downBtn.disabled = index === rows.length - 1;
      downBtn.addEventListener("click", () => {
        const next = rows.slice();
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
        saveSecretariat(next);
        logActivity(`Reordered secretariat member: ${member.name}`);
      });

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        const nextName = window.prompt("Name", member.name);
        if (!nextName) return;
        const nextTitle = window.prompt("Title", member.title) || member.title;
        const nextDesc = window.prompt("Description", member.description) || member.description;
        const nextPhoto = window.prompt("Photo URL / Path", member.photo) || member.photo;

        const next = rows.slice();
        next[index] = {
          ...member,
          name: nextName.trim(),
          title: String(nextTitle).trim(),
          description: String(nextDesc).trim(),
          photo: String(nextPhoto).trim(),
        };
        saveSecretariat(next);
        logActivity(`Edited secretariat member: ${member.name}`);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        if (!window.confirm(`Delete ${member.name}?`)) return;
        const next = rows.filter((entry) => entry.id !== member.id);
        saveSecretariat(next);
        logActivity(`Deleted secretariat member: ${member.name}`);
      });

      actions.append(upBtn, downBtn, editBtn, deleteBtn);
      li.appendChild(actions);
      secretariatList.appendChild(li);
    });
  };

  const getLaunchSettingsPayload = () => ({
    applicationsOpen: applicationsOpenToggle && applicationsOpenToggle.value === "open",
    launchDate: fromDateTimeLocalValue(launchDateOpsInput && launchDateOpsInput.value),
    conferenceDate: fromDateTimeLocalValue(conferenceDateInput && conferenceDateInput.value),
    locationText: String(locationTextInput && locationTextInput.value || "").trim(),
    conferenceDescription: String(conferenceDescriptionInput && conferenceDescriptionInput.value || "").trim(),
    countdownEnabled: countdownEnabledToggle && countdownEnabledToggle.value === "on",
  });

  const saveLaunchSettings = async (isManualSave) => {
    if (!launchOpsForm) return;

    const previous = window.ImperiumAuth.getSiteSettings();
    const payload = getLaunchSettingsPayload();
    const result = window.ImperiumAuth.updateSiteSettings(currentUser, payload);

    if (launchOpsMessage) {
      launchOpsMessage.classList.toggle("success", result.success);
      launchOpsMessage.textContent = result.message;
    }

    if (!result.success) {
      showToast(result.message, false);
      return;
    }

    if (previous.applicationsOpen !== payload.applicationsOpen) {
      logActivity(`Applications ${payload.applicationsOpen ? "opened" : "closed"}`);
      if (payload.applicationsOpen && notifyAllOnOpenToggle && notifyAllOnOpenToggle.value === "on") {
        await markAllNotified();
      }
    }

    if (isManualSave) {
      showToast("Launch settings saved.", true);
    }
  };

  const scheduleAutoSave = () => {
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
      saveLaunchSettings(false);
    }, 400);
  };

  const hydrateLaunchForm = () => {
    if (!launchOpsForm) return;
    const settings = window.ImperiumAuth.getSiteSettings();
    if (applicationsOpenToggle) applicationsOpenToggle.value = settings.applicationsOpen ? "open" : "closed";
    if (launchDateOpsInput) launchDateOpsInput.value = toDateTimeLocalValue(settings.launchDate);
    if (conferenceDateInput) conferenceDateInput.value = toDateTimeLocalValue(settings.conferenceDate);
    if (locationTextInput) locationTextInput.value = String(settings.locationText || "");
    if (conferenceDescriptionInput) conferenceDescriptionInput.value = String(settings.conferenceDescription || "");
    if (countdownEnabledToggle) countdownEnabledToggle.value = settings.countdownEnabled === false ? "off" : "on";
    if (notifyAllOnOpenToggle) notifyAllOnOpenToggle.value = "off";
  };

  const renderMaintenanceStatus = (enabled) => {
    if (maintenanceStatusBadge) {
      maintenanceStatusBadge.textContent = enabled ? "Maintenance" : "Live";
      maintenanceStatusBadge.classList.toggle("is-on", enabled);
    }
    if (maintenanceModeText) {
      maintenanceModeText.textContent = enabled ? "Maintenance" : "Live";
    }
  };

  const hydrateMaintenanceForm = () => {
    if (!maintenanceOpsForm) return;
    const settings = window.ImperiumAuth.getSiteSettings();
    const enabled = Boolean(settings.maintenanceMode);
    if (maintenanceModeToggle) maintenanceModeToggle.checked = enabled;
    if (maintenanceMessageInput) {
      maintenanceMessageInput.value = String(settings.maintenanceMessage || "");
    }
    renderMaintenanceStatus(enabled);
  };

  const saveMaintenanceSettings = () => {
    if (!maintenanceOpsForm) return;

    const maintenanceMode = Boolean(maintenanceModeToggle && maintenanceModeToggle.checked);
    const maintenanceMessage = String(maintenanceMessageInput && maintenanceMessageInput.value || "").trim();

    const result = window.ImperiumAuth.updateSiteSettings(currentUser, {
      maintenanceMode,
      maintenanceMessage,
    });

    if (maintenanceOpsMessage) {
      maintenanceOpsMessage.classList.toggle("success", Boolean(result.success));
      maintenanceOpsMessage.textContent = String(result.message || "Maintenance settings updated.");
    }

    if (!result.success) {
      showToast(String(result.message || "Failed to update maintenance settings."), false);
      return;
    }

    renderMaintenanceStatus(maintenanceMode);
    showToast(`Maintenance mode ${maintenanceMode ? "enabled" : "disabled"}.`, true);
    logActivity(`Set maintenance mode to ${maintenanceMode ? "ON" : "OFF"}`);
  };

  const bindEvents = () => {
    if (eaSearchInput) eaSearchInput.addEventListener("input", renderWaitlistTable);
    if (eaSchoolFilter) eaSchoolFilter.addEventListener("change", renderWaitlistTable);
    if (eaInterestFilter) eaInterestFilter.addEventListener("change", renderWaitlistTable);

    if (eaExportBtn) eaExportBtn.addEventListener("click", exportRowsToCsv);
    if (eaNotifyAllBtn) eaNotifyAllBtn.addEventListener("click", () => {
      if (!window.confirm("Mark all early access students as notified?")) return;
      markAllNotified();
    });

    if (eaTableBody) {
      eaTableBody.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) return;
        const action = String(target.getAttribute("data-action") || "");
        const id = String(target.getAttribute("data-id") || "");
        if (!action || !id) return;

        if (action === "delete" && !window.confirm("Delete this early access signup?")) {
          return;
        }

        target.disabled = true;
        try {
          if (action === "toggle-notified") {
            const row = waitlistRows.find((item) => String(item.id || "") === id);
            const nextNotified = !(row && row.notified);
            await postWaitlistAction({ action: "setNotified", id, notified: nextNotified });
            logActivity(`${nextNotified ? "Marked" : "Unmarked"} notified for ${row ? row.email : id}`);
          } else if (action === "delete") {
            await postWaitlistAction({ action: "delete", id });
            logActivity(`Deleted early access entry ${id}`);
          }
          renderWaitlistTable();
        } catch (error) {
          showToast(String(error.message || "Update failed"), false);
        } finally {
          target.disabled = false;
        }
      });
    }

    if (launchOpsForm) {
      launchOpsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        saveLaunchSettings(true);
      });
      launchOpsForm.addEventListener("change", scheduleAutoSave);
      launchOpsForm.addEventListener("input", scheduleAutoSave);
    }

    if (maintenanceModeToggle) {
      maintenanceModeToggle.addEventListener("change", () => {
        renderMaintenanceStatus(Boolean(maintenanceModeToggle.checked));
      });
    }

    if (maintenanceOpsForm) {
      maintenanceOpsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        saveMaintenanceSettings();
      });
    }

    if (announcementForm) {
      announcementForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const title = String(announcementTitleInput && announcementTitleInput.value || "").trim();
        const body = String(announcementBodyInput && announcementBodyInput.value || "").trim();
        const sendToEarly = announcementSendToggle && announcementSendToggle.value === "on";

        if (!title || !body) {
          if (announcementMessage) {
            announcementMessage.classList.remove("success");
            announcementMessage.textContent = "Please fill title and announcement body.";
          }
          return;
        }

        const list = getAnnouncements();
        list.unshift({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          title,
          body,
          sendToEarly,
          author: currentUser.username,
          createdAt: new Date().toISOString(),
        });
        writeLocal(ANNOUNCEMENTS_KEY, list.slice(0, 200));
        const sync = syncWebsiteAnnouncement(list);

        if (sendToEarly) {
          await markAllNotified();
        }

        if (announcementMessage) {
          announcementMessage.classList.toggle("success", Boolean(sync.success));
          announcementMessage.textContent = sync.success
            ? "Announcement published."
            : String(sync.message || "Announcement saved locally but website sync failed.");
        }

        if (announcementForm) announcementForm.reset();
        renderAnnouncements();
        logActivity(`Published announcement: ${title}`);
      });
    }

    if (clearAnnouncementsBtn) {
      clearAnnouncementsBtn.addEventListener("click", () => {
        if (!window.confirm("Clear all announcements? This cannot be undone.")) return;
        writeLocal(ANNOUNCEMENTS_KEY, []);
        const sync = syncWebsiteAnnouncement([]);
        renderAnnouncements();
        if (announcementMessage) {
          announcementMessage.classList.toggle("success", Boolean(sync.success));
          announcementMessage.textContent = sync.success
            ? "All announcements cleared."
            : String(sync.message || "Announcements cleared locally but website sync failed.");
        }
        logActivity("Cleared all announcements");
        showToast(sync.success ? "Announcements cleared." : "Cleared locally, sync failed.", Boolean(sync.success));
      });
    }

    if (secretariatForm) {
      secretariatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = String(secNameInput && secNameInput.value || "").trim();
        const title = String(secTitleInput && secTitleInput.value || "").trim();
        const description = String(secDescInput && secDescInput.value || "").trim();
        const photo = String(secPhotoInput && secPhotoInput.value || "").trim();

        if (!name || !title || !description || !photo) {
          showToast("Please complete all secretariat fields.", false);
          return;
        }

        const rows = getSecretariat();
        rows.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          title,
          description,
          photo,
        });

        saveSecretariat(rows);
        secretariatForm.reset();
        showToast("Secretariat member added.", true);
        logActivity(`Added secretariat member: ${name}`);
      });
    }

    window.addEventListener("storage", (event) => {
      if ([WAITLIST_KEY, ANNOUNCEMENTS_KEY, SECRETARIAT_KEY, ACTIVITY_KEY].includes(event.key || "")) {
        renderAnnouncements();
        renderSecretariat();
        renderActivityLog();
        fetchWaitlistRows().then(renderWaitlistTable);
      }
    });
  };

  const init = async () => {
    hydrateLaunchForm();
    hydrateMaintenanceForm();
    renderAnnouncements();
    renderSecretariat();
    renderActivityLog();
    await fetchWaitlistRows();
    renderWaitlistTable();
    bindEvents();
  };

  init();
})();
