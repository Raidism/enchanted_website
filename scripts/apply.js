(function () {
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  const themeToggle = document.getElementById("themeToggle");
  const themeStorageKey = "imperium-theme";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let isThemeAnimating = false;

  const setTheme = (theme, withAnimation = false) => {
    document.body.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // ignore
    }
    if (!themeToggle) return;
    const nextTheme = theme === "dark" ? "light" : "dark";
    themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
    themeToggle.setAttribute("aria-pressed", String(theme === "light"));
    if (withAnimation) {
      themeToggle.classList.remove("is-animating");
      void themeToggle.offsetWidth;
      themeToggle.classList.add("is-animating");
    }
  };

  const storedTheme = (typeof localStorage !== "undefined" && localStorage.getItem(themeStorageKey)) || null;
  const initialTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
  setTheme(initialTheme);

  const animateThemeWipe = ({ layerTheme, fromRadius, toRadius, originX, originY }) => {
    const layer = document.createElement("div");
    layer.className = "theme-wipe-layer";
    layer.setAttribute("data-theme", layerTheme);
    document.body.appendChild(layer);

    return new Promise((resolve) => {
      const animation = layer.animate(
        [
          { clipPath: `circle(${fromRadius}px at ${originX}px ${originY}px)` },
          { clipPath: `circle(${toRadius}px at ${originX}px ${originY}px)` },
        ],
        {
          duration: 620,
          easing: "cubic-bezier(0.22, 0.9, 0.28, 1)",
          fill: "forwards",
        }
      );

      animation.onfinish = () => {
        layer.remove();
        resolve();
      };
      animation.oncancel = () => {
        layer.remove();
        resolve();
      };
    });
  };

  if (themeToggle) {
    themeToggle.addEventListener("click", async (event) => {
      if (isThemeAnimating) return;
      const currentTheme = document.body.getAttribute("data-theme") || "dark";
      const nextTheme = currentTheme === "dark" ? "light" : "dark";

      if (prefersReducedMotion) {
        setTheme(nextTheme, true);
        return;
      }

      const rect = themeToggle.getBoundingClientRect();
      const originX = typeof event.clientX === "number" && event.clientX > 0
        ? event.clientX
        : rect.left + rect.width / 2;
      const originY = typeof event.clientY === "number" && event.clientY > 0
        ? event.clientY
        : rect.top + rect.height / 2;

      const farX = Math.max(originX, window.innerWidth - originX);
      const farY = Math.max(originY, window.innerHeight - originY);
      const maxRadius = Math.hypot(farX, farY);

      isThemeAnimating = true;
      themeToggle.disabled = true;

      try {
        if (nextTheme === "light") {
          setTheme("light", true);
          await animateThemeWipe({
            layerTheme: "light",
            fromRadius: 0,
            toRadius: maxRadius,
            originX,
            originY,
          });
        } else {
          setTheme("dark", true);
          await animateThemeWipe({
            layerTheme: "light",
            fromRadius: maxRadius,
            toRadius: 0,
            originX,
            originY,
          });
        }
      } finally {
        themeToggle.disabled = false;
        isThemeAnimating = false;
      }
    });
  }

  const statusEl = document.getElementById("applyStatusMessage");
  const setStatus = (text) => {
    if (!statusEl) return;
    statusEl.textContent = text || "";
  };

  const LINKS = {
    volunteer: "https://forms.gle/zPm8ZHr6VGuTsRBF6",
    media: "https://forms.gle/YwM59JFdP2LFyfu6A",
    security: "https://forms.gle/CkhK5mvSkA5Rbanp6",
  };

  const applyCards = document.querySelectorAll(".apply-card");
  applyCards.forEach((card) => {
    const team = card.getAttribute("data-team");
    const button = card.querySelector('[data-team-cta]');
    if (!team || !button) return;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      const url = LINKS[team];
      if (!url) {
        setStatus("Application form for this team is not configured yet.");
        return;
      }

      setStatus("Redirecting you to the forms page now…");

      if (window.ImperiumTracker && typeof window.ImperiumTracker.trackEvent === "function") {
        window.ImperiumTracker.trackEvent("team_application_click", team);
      }

      if (typeof gsap !== "undefined") {
        gsap.to(button, {
          scale: 0.96,
          duration: 0.12,
          ease: "power2.in",
          onComplete: () => {
            window.open(url, "_blank", "noopener");
            gsap.to(button, { scale: 1.02, duration: 0.18, ease: "power2.out" });
          },
        });
      } else {
        window.open(url, "_blank", "noopener");
      }
    });
  });
})();

