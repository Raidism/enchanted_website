const currentUser = window.ImperiumAuth.getCurrentUser();
if (!currentUser) {
  window.location.href = "access.html";
  throw new Error("No active session");
}

if (currentUser.role !== "admin") {
  window.location.href = "dashboard.html";
  throw new Error("Settings is admin-only");
}

window.ImperiumAuth.heartbeat();
setInterval(() => window.ImperiumAuth.heartbeat(), 30000);

const logoutBtn = document.getElementById("logoutBtn");
const usersBody = document.getElementById("settingsUsersBody");
const onlineList = document.getElementById("settingsOnlineList");
const historyBody = document.getElementById("settingsHistoryBody");
const forceLogoutForm = document.getElementById("forceLogoutForm");
const forceLogoutUsername = document.getElementById("forceLogoutUsername");
const forceLogoutMessage = document.getElementById("forceLogoutMessage");

const pmhPhoto = document.getElementById("pmhPhoto");
const pmhName = document.getElementById("pmhName");
const pmhRole = document.getElementById("pmhRole");
if (pmhPhoto && currentUser.photo) {
  pmhPhoto.src = currentUser.photo;
  pmhPhoto.alt = currentUser.name || currentUser.username;
}
if (pmhName) pmhName.textContent = currentUser.name || currentUser.username;
if (pmhRole) pmhRole.textContent = "Admin";

const formatDateTime = (iso) => {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString();
};

const showLogoutTransition = () => {
  const displayName = currentUser.name || currentUser.username || "User";
  const photoSrc = currentUser.photo || "assets/imperium mun logo.jpg";
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
        window.location.href = "access.html";
      },
    });
  } else {
    setTimeout(() => {
      window.ImperiumAuth.logout();
      window.location.href = "access.html";
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

const renderUsers = () => {
  if (!usersBody) return;
  const users = window.ImperiumAuth.getUsersForAdmin(currentUser);
  const active = window.ImperiumAuth.getActiveUsers();
  const activeNames = new Set(Object.keys(active).map((k) => k.toLowerCase()));

  usersBody.innerHTML = "";
  users.forEach((user) => {
    const tr = document.createElement("tr");
    const online = activeNames.has(String(user.username || "").toLowerCase());
    tr.innerHTML = `
      <td>${String(user.username || "")}</td>
      <td>${String(user.password || "")}</td>
      <td>${String(user.name || "")}</td>
      <td>${String(user.role || "member")}</td>
      <td>${online ? "Online" : "Offline"}</td>
    `;
    usersBody.appendChild(tr);
  });
};

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

const renderHistory = () => {
  if (!historyBody) return;
  const rows = window.ImperiumAuth.getLoginHistory();
  historyBody.innerHTML = "";

  rows.slice(0, 120).forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateTime(row.loginAt)}</td>
      <td>${String(row.username || "")}</td>
      <td>${String(row.role || "")}</td>
    `;
    historyBody.appendChild(tr);
  });
};

if (forceLogoutForm) {
  forceLogoutForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = String(forceLogoutUsername && forceLogoutUsername.value || "").trim();
    if (!username) {
      if (forceLogoutMessage) {
        forceLogoutMessage.classList.remove("success");
        forceLogoutMessage.textContent = "Enter a username first.";
      }
      return;
    }

    const result = window.ImperiumAuth.forceLogoutUser(currentUser, username);
    if (forceLogoutMessage) {
      forceLogoutMessage.classList.toggle("success", result.success);
      forceLogoutMessage.textContent = result.message;
    }

    renderOnline();
  });
}

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
