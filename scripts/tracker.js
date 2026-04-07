(function () {
  const API_BASE = String((window.EnchantedRuntime && window.EnchantedRuntime.apiBase) || "/api").replace(/\/+$/, "");
  const ANALYTICS_API_URL = `${API_BASE}/analytics`;
  const TRACK_API_URL = `${API_BASE}/analytics/track`;
  const DEDUPE_WINDOW_MS = 2000;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = String(connection && connection.effectiveType ? connection.effectiveType : "").toLowerCase();
  const isConstrainedNetwork = Boolean(connection && connection.saveData) || /(^|[^a-z])2g|3g([^a-z]|$)/.test(effectiveType);
  let lastTracked = { path: "", timestamp: 0 };

  const detectDevice = () => {
    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isInApp = /Instagram|FBAN|FBAV|Line\//i.test(ua);

    let browser = "Unknown";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
    else if (/Firefox\//.test(ua)) browser = "Firefox";

    return `${isMobile ? "Mobile" : "Desktop"} • ${browser}${isInApp ? " • In-App" : ""}`;
  };

  const shouldTrack = () => {
    const dnt = String(navigator.doNotTrack || window.doNotTrack || "").trim();
    if (dnt === "1" || dnt.toLowerCase() === "yes") {
      return false;
    }
    if (document.visibilityState === "hidden") {
      return false;
    }
    return true;
  };

  const trackView = async () => {
    const route = String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
    const routeToLegacyPath = {
      "/": "index.html",
      "/contact": "index.html",
      "/access": "access-gate.html",
      "/portal": "access.html",
      "/dashboard": "dashboard.html",
      "/applications": "applications.html",
      "/waitlist": "waitlist.html",
      "/settings": "settings.html",
      "/ops": "ops.html",
      "/locked": "locked.html",
    };
    const path = routeToLegacyPath[route] || (window.location.pathname.split("/").pop() || "index.html");

    if (
      lastTracked.path === path
      && typeof lastTracked.timestamp === "number"
      && Date.now() - lastTracked.timestamp < DEDUPE_WINDOW_MS
    ) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      path,
      ip: "Unknown",
      country: "Unknown",
      countryCode: "--",
      flag: "🌐",
      device: detectDevice(),
      language: String(navigator.language || ""),
      timezone: String((Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || ""),
      userAgent: navigator.userAgent,
    };

    const analyticsPayload = JSON.stringify({ action: "track", entry });

    if (navigator.sendBeacon) {
      const blob = new Blob([analyticsPayload], { type: "application/json" });
      navigator.sendBeacon(ANALYTICS_API_URL, blob);
    } else {
      fetch(ANALYTICS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: analyticsPayload,
      }).catch(() => {
        // Skip analytics failures silently.
      });
    }

    lastTracked = { path, timestamp: Date.now() };
  };

  const scheduleTrack = () => {
    if (!shouldTrack()) {
      return;
    }

    const run = () => {
      trackView().catch(() => {
        // Ignore tracking errors.
      });
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 1500 });
      return;
    }

    setTimeout(run, 350);
  };

  const trackEvent = (name, lbl) => {
    try {
      const body = JSON.stringify({ event: name, label: lbl || window.location.pathname });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(TRACK_API_URL, new Blob([body], { type: "application/json" }));
      } else {
        fetch(TRACK_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body,
        }).catch(() => {});
      }
    } catch {}
  };

  window.EnchantedSummitTracker = {
    track: scheduleTrack,
    trackEvent,
  };

  if (document.readyState === "complete") {
    scheduleTrack();
  } else {
    window.addEventListener("load", scheduleTrack, { once: true });
  }
})();
