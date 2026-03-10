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

const _appProfileKey = String(currentUser.username || "").trim().toLowerCase();
const _appRoleLabels = {
  admin:          "Head of IT",
  "ln-obidat":    "Under Secretary General",
  ahmadph:        "Secretary General",
  toleenkmedia:   "Head of Media",
};
const _appDisplayName = currentUser.name || currentUser.username;
const _appRoleLabel   = _appRoleLabels[_appProfileKey] || (currentUser.role === "admin" ? "Admin" : "Member");

// Populate mini hero
const _aPmhPhoto = document.getElementById("pmhPhoto");
const _aPmhName  = document.getElementById("pmhName");
const _aPmhRole  = document.getElementById("pmhRole");
if (_aPmhPhoto && currentUser.photo) { _aPmhPhoto.src = currentUser.photo; _aPmhPhoto.alt = _appDisplayName; }
if (_aPmhName) _aPmhName.textContent = _appDisplayName;
if (_aPmhRole) _aPmhRole.textContent = _appRoleLabel;

const welcomeText = document.getElementById("welcomeText");
const logoutBtn   = document.getElementById("logoutBtn");

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
      <p class="logout-name">${_appDisplayName}</p>
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

// GSAP entrance + page transitions
(function initAppGSAP() {
  if (typeof gsap === "undefined") return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.body.style.opacity = "0";
  requestAnimationFrame(() => {
    gsap.to(document.body, { opacity: 1, duration: 0.55, ease: "power2.out" });
  });

  if (!prefersReduced) {
    const header  = document.querySelector(".dash-header");
    const hero    = document.getElementById("pageMiniHero");
    const section = document.querySelector(".dash-main > .section");
    const cards   = document.querySelectorAll(".app-card");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (header)  tl.from(header,  { y: -22, opacity: 0, duration: 0.5 }, 0);
    if (hero)    tl.from(hero,    { y: 34, opacity: 0, scale: 0.97, duration: 0.72, ease: "power4.out" }, 0.1);
    if (section) tl.from(section, { y: 26, opacity: 0, duration: 0.6 }, 0.28);
    if (cards.length) tl.from(cards, { y: 28, opacity: 0, scale: 0.93, stagger: 0.1, duration: 0.58, ease: "back.out(1.7)" }, 0.42);
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
