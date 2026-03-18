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
    volunteer: "https://forms.gle/zPm8ZHr6VGuTsRBF6",
    media: "https://forms.gle/YwM59JFdP2LFyfu6A",
    security: "https://forms.gle/CkhK5mvSkA5Rbanp6",
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
    overlay.classList.add("is-active");
    overlay.setAttribute("aria-hidden", "false");
  };

  const hideRedirectOverlay = () => {
    if (!overlay) return;
    overlay.classList.remove("is-active", "is-volunteer");
    overlay.setAttribute("aria-hidden", "true");
  };

  const animateCardSelection = (card, button, team) => {
    if (typeof gsap === "undefined" || prefersReducedMotion) return;
    const isVolunteer = team === "volunteer";

    gsap.to(card, {
      scale: isVolunteer ? 1.12 : 1.04,
      y: isVolunteer ? -8 : -3,
      boxShadow: isVolunteer
        ? "0 30px 80px rgba(79, 209, 197, 0.35), 0 0 0 1px rgba(240, 218, 160, 0.35)"
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
        opacity: isVolunteer ? 0.45 : 0.62,
        filter: isVolunteer ? "blur(2px)" : "blur(1px)",
        duration: 0.35,
        ease: "power2.out",
      });
    }
  };

  let redirectInProgress = false;

  const applyCards = document.querySelectorAll(".apply-card");
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

      const redirectDelay = team === "volunteer" ? 1350 : 760;

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
          pageMain.style.filter = "";
        }
      }, 4000);
    });
  });
})();

