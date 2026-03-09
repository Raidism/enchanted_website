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

if (currentUser.role === "admin") {
  welcomeText.textContent = "Welcome admin";
} else {
  welcomeText.textContent = `Welcome ${currentUser.username}`;
}

logoutBtn.addEventListener("click", () => {
  logoutBtn.classList.add("is-loading");
  logoutBtn.disabled = true;

  setTimeout(() => {
    window.ImperiumAuth.logout();
    window.location.href = "access.html";
  }, 900);
});
