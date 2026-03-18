(function () {
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const statusEl = document.getElementById("applyStatusMessage");
  const setStatus = (text) => {
    if (!statusEl) return;
    statusEl.textContent = text || "";
  };

  const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");

  const overlay = document.getElementById("applyRedirectOverlay");
  const overlayTeam = document.getElementById("applyRedirectTeam");
  const overlayTitle = document.getElementById("applyRedirectTitle");
  const overlayMessage = document.getElementById("applyRedirectMessage");
  const pageMain = document.querySelector("main.apply-main");

  const TEAM_TITLES = {
    volunteer: "Volunteer Team",
    media: "Media Team",
    security: "Security Team",
  };

  const LINKS = {
    volunteer: "https://forms.gle/WRPNc177MNwcm8899",
    media: "https://forms.gle/AyDvjdU37rn2L98GA",
    security: "https://forms.gle/bZL3meH9Mfaj2Zz66",
  };

  const applyCards = document.querySelectorAll(".apply-team-card");
  const forceRevealVisible = () => {
    applyCards.forEach((card) => {
      card.classList.add("show");
      card.style.opacity = "1";
      card.style.transform = "none";
    });
  };

  const applyOpenState = async () => {
    let settings = null;
    try {
      if (window.ImperiumAuth && typeof window.ImperiumAuth.getSiteSettings === "function") {
        settings = window.ImperiumAuth.getSiteSettings();
      }
    } catch {
      settings = null;
    }

    try {
      const response = await fetch(`${API_BASE}/site-settings`, { method: "GET", cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (payload && payload.settings) settings = payload.settings;
      }
    } catch {
      // Keep cached settings when refresh fails.
    }

    const teamOpen = Boolean(settings && settings.teamApplicationsOpen);
    if (teamOpen) {
      setStatus("");
      const fallbackBtn = document.getElementById("applyEarlyAccessBtn");
      if (fallbackBtn && fallbackBtn.parentElement) {
        fallbackBtn.parentElement.remove();
      }
      applyCards.forEach((card) => {
        card.hidden = false;
        const cta = card.querySelector("[data-team-cta]");
        if (cta) cta.disabled = false;
      });
      return;
    }

    setStatus("Team recruitment is currently closed. Keep an eye on the countdown timer for when applications reopen.");
    applyCards.forEach((card) => {
      card.hidden = true;
    });

    if (!document.getElementById("applyEarlyAccessBtn")) {
      const holder = document.createElement("div");
      holder.className = "apply-early-access-wrap";
      holder.innerHTML = '<a id="applyEarlyAccessBtn" class="cta" href="/#countdown">Check Countdown ⏳</a>';
      const section = document.querySelector(".apply-section");
      if (section) section.appendChild(holder);
    }
  };

  const showRedirectOverlay = (team) => {
    if (!overlay) return;
    const teamTitle = TEAM_TITLES[team] || "Team Application";
    const isVolunteer = team === "volunteer";

    if (overlayTeam) overlayTeam.textContent = teamTitle;
    if (overlayTitle) {
      overlayTitle.textContent = isVolunteer
        ? "Redirecting you to the application space"
        : "Preparing your application space...";
    }
    if (overlayMessage) {
      overlayMessage.textContent = isVolunteer
        ? "Launching volunteer application in this page."
        : `Launching ${teamTitle.toLowerCase()} application in this page.`;
    }

    overlay.classList.toggle("is-volunteer", isVolunteer);
    overlay.hidden = false;
    overlay.classList.add("is-active");
    overlay.setAttribute("aria-hidden", "false");
  };

  const hideRedirectOverlay = () => {
    if (!overlay) return;
    overlay.classList.remove("is-active", "is-volunteer");
    overlay.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
  };

  const animateCardSelection = (card, button, team) => {
    if (typeof gsap === "undefined" || prefersReducedMotion) return;
    const isVolunteer = team === "volunteer";

    gsap.to(card, {
      scale: isVolunteer ? 1.02 : 1.01,
      y: isVolunteer ? -3 : -2,
      boxShadow: isVolunteer
        ? "0 20px 54px rgba(79, 209, 197, 0.3), 0 0 0 1px rgba(240, 218, 160, 0.3)"
        : "0 20px 56px rgba(213, 180, 101, 0.28)",
      duration: 0.42,
      ease: "power3.out",
    });

    gsap.to(button, {
      scale: 0.94,
      duration: 0.12,
      ease: "power2.in",
      yoyo: true,
      repeat: 1,
    });

    if (pageMain) {
      gsap.to(pageMain, {
        opacity: 0.82,
        duration: 0.25,
        ease: "power2.out",
      });
    }
  };

  let redirectInProgress = false;

  forceRevealVisible();
  applyOpenState();

  window.addEventListener("storage", (event) => {
    if (event.key === "imperium_site_settings") {
      applyOpenState();
    }
  });

  window.addEventListener("imperium:site-settings-updated", () => {
    applyOpenState();
  });

  applyCards.forEach((card) => {
    const team = card.getAttribute("data-team");
    const button = card.querySelector('[data-team-cta]');
    if (!team || !button) return;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (redirectInProgress) return;

      const url = LINKS[team];
      if (!url) {
        setStatus("Application form for this team is not configured yet.");
        return;
      }

      redirectInProgress = true;
      applyCards.forEach((item) => {
        const cta = item.querySelector('[data-team-cta]');
        if (cta) cta.disabled = true;
      });

      setStatus(`Logging click and preparing ${TEAM_TITLES[team] || "team"} form...`);

      if (window.ImperiumTracker && typeof window.ImperiumTracker.trackEvent === "function") {
        window.ImperiumTracker.trackEvent("team_application_click", team);
      }

      card.classList.add("is-selected");
      animateCardSelection(card, button, team);
      showRedirectOverlay(team);

      const redirectDelay = 350; // Use a short delay so mobile browsers don't block the redirect and the animation has time to be seen

      window.setTimeout(() => {
        window.location.assign(url);
      }, redirectDelay);

      // If navigation is blocked, recover UI.
      window.setTimeout(() => {
        if (document.visibilityState === "hidden") return;
        redirectInProgress = false;
        hideRedirectOverlay();
        setStatus("Redirect could not start. Please try again.");
        applyCards.forEach((item) => {
          item.classList.remove("is-selected");
          const cta = item.querySelector('[data-team-cta]');
          if (cta) cta.disabled = false;
        });
        if (pageMain) {
          pageMain.style.opacity = "";
        }
      }, 4000);
    });
  });
})();

