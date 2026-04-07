(function () {
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const statusEl = document.getElementById("applyStatusMessage");
  const setStatus = (text, statusClass) => {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.className = "apply-status-message";
    if (statusClass) statusEl.classList.add(statusClass);
  };

  const API_BASE = String((window.EnchantedRuntime && window.EnchantedRuntime.apiBase) || "/api").replace(/\/+$/, "");
  const SETTINGS_REQUEST_TIMEOUT_MS = 5000;

  const overlay = document.getElementById("applyRedirectOverlay");
  const overlayTeam = document.getElementById("applyRedirectTeam");
  const overlayTitle = document.getElementById("applyRedirectTitle");
  const overlayMessage = document.getElementById("applyRedirectMessage");
  const pageMain = document.querySelector("main.apply-main");
  const closedRolesPreview = document.getElementById("applyClosedRolesPreview");

  const TEAM_TITLES = {
    volunteer: "Volunteer Team",
    media: "Media & Press Team",
    security: "Security Team",
  };

  const LINKS = {
    volunteer: "https://docs.google.com/forms/d/e/1FAIpQLScPnumk5ODdvUkEbqRRyko1MvsyPiHTmjcTaIIRvaC0cG1hnQ/viewform",
    media: "https://docs.google.com/forms/d/e/1FAIpQLSdbqe0iyVbLSdayH8g6Rh2KLq65vKehZSVMtorVBgt66VBlmQ/viewform",
    security: "https://docs.google.com/forms/d/e/1FAIpQLSc9FI420bulwJn0aA9IIHPJxJ9vJ6wV_5upcTLjP-pTo4UKvw/viewform",
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
      if (window.EnchantedAuth && typeof window.EnchantedAuth.getSiteSettings === "function") {
        settings = window.EnchantedAuth.getSiteSettings();
      }
    } catch {
      settings = null;
    }

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), SETTINGS_REQUEST_TIMEOUT_MS);
      const response = await fetch(`${API_BASE}/site-settings`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      }).finally(() => {
        window.clearTimeout(timeout);
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload && payload.settings) settings = payload.settings;
      }
    } catch {
      // Keep cached settings when refresh fails.
    }

    const teamOpen = Boolean(settings && settings.teamApplicationsOpen);
    if (teamOpen) {
      setStatus("\u2713 Team applications are open — choose your team and apply now.", "open");
      if (closedRolesPreview) closedRolesPreview.hidden = true;
      applyCards.forEach((card) => {
        card.hidden = false;
        const cta = card.querySelector("[data-team-cta]");
        if (cta) cta.disabled = false;
      });
      return;
    }

    setStatus("Applications are currently closed. Follow our Instagram to be notified when they open.", "closed");
    applyCards.forEach((card) => {
      card.hidden = true;
      const cta = card.querySelector("[data-team-cta]");
      if (cta) cta.disabled = true;
    });

    if (closedRolesPreview) closedRolesPreview.hidden = false;
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
    if (event.key === "enchanted_site_settings") {
      applyOpenState();
    }
  });

  window.addEventListener("enchanted:site-settings-updated", () => {
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

      if (window.EnchantedSummitTracker && typeof window.EnchantedSummitTracker.trackEvent === "function") {
        window.EnchantedSummitTracker.trackEvent("team_application_click", team);
      }

      card.classList.add("is-selected");
      animateCardSelection(card, button, team);
      showRedirectOverlay(team);

      const redirectDelay = 350; // Keep a tiny delay so animation is visible before leaving.

      const launchExternalUrl = () => {
        // In-app browsers can block location.assign intermittently, so fallback to multiple navigation methods.
        try {
          window.location.assign(url);
        } catch {
          // Continue to fallback below.
        }

        try {
          const bridgeLink = document.createElement("a");
          bridgeLink.href = url;
          bridgeLink.rel = "noopener noreferrer";
          bridgeLink.style.position = "absolute";
          bridgeLink.style.left = "-9999px";
          document.body.appendChild(bridgeLink);
          bridgeLink.click();
          bridgeLink.remove();
        } catch {
          // Continue to final fallback.
        }

        window.location.href = url;
      };

      window.setTimeout(() => {
        launchExternalUrl();
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

