const currentUser = window.ImperiumAuth.getCurrentUser();
if (!currentUser) {
  window.location.href = "/access";
  throw new Error("No active session");
}

window.ImperiumAuth.heartbeat();
setInterval(() => window.ImperiumAuth.heartbeat(), 30000);

const params = new URLSearchParams(window.location.search);
const feature = String(params.get("feature") || "restricted").trim().toLowerCase();
const from = String(params.get("from") || "dashboard").trim();

const normalizeBackRoute = (value) => {
  const candidate = String(value || "").trim().toLowerCase();
  const map = {
    dashboard: "/dashboard",
    "dashboard.html": "/dashboard",
    waitlist: "/waitlist",
    "waitlist.html": "/waitlist",
    applications: "/applications",
    "applications.html": "/applications",
  };
  return map[candidate] || "/dashboard";
};

const featureLabels = {
  ops: "Ops Center",
  settings: "Settings",
  restricted: "Restricted section",
};

const lockedTitle = document.getElementById("lockedTitle");
const lockedMessage = document.getElementById("lockedMessage");
const backLink = document.getElementById("backLink");

if (lockedTitle) {
  lockedTitle.textContent = `${featureLabels[feature] || "This section"} is locked for your account`;
}
if (lockedMessage) {
  lockedMessage.textContent = "This section is available only to approved admin roles. If you need access, contact the main admin.";
}
if (backLink) {
  backLink.href = normalizeBackRoute(from);
}

if (currentUser.role !== "admin") {
  const lockedNavLinks = document.querySelectorAll("[data-locked-feature]");
  lockedNavLinks.forEach((link) => {
    link.classList.add("locked-link");
    link.setAttribute("aria-disabled", "true");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetFeature = String(link.getAttribute("data-locked-feature") || "restricted").trim().toLowerCase();
      window.location.href = `/locked?feature=${encodeURIComponent(targetFeature)}&from=${encodeURIComponent(safeBackFromCurrent())}`;
    });
  });
}

function safeBackFromCurrent() {
  const candidate = String(from || "dashboard").trim();
  const safeRoute = normalizeBackRoute(candidate);
  return safeRoute.replace(/^\//, "");
}

const pmhPhoto = document.getElementById("pmhPhoto");
const pmhName = document.getElementById("pmhName");
const pmhRole = document.getElementById("pmhRole");
const displayName = currentUser.name || currentUser.username;
if (pmhPhoto) {
  pmhPhoto.src = currentUser.photo || "assets/imperium mun logo.jpg";
  pmhPhoto.alt = displayName;
}
if (pmhName) pmhName.textContent = displayName;
if (pmhRole) pmhRole.textContent = currentUser.role === "admin" ? "Admin" : "Member";

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    logoutBtn.classList.add("is-loading");
    logoutBtn.disabled = true;

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
          window.location.href = "/access";
        },
      });
    } else {
      setTimeout(() => {
        window.ImperiumAuth.logout();
        window.location.href = "/access";
      }, 1600);
    }
  });
}
