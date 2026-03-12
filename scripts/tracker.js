(function () {
  const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");
  const ANALYTICS_API_URL = `${API_BASE}/analytics`;
  const DEDUPE_WINDOW_MS = 2000;
  let lastTracked = { path: "", timestamp: 0 };

  const flagFromCode = (code) => {
    const normalized = String(code || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) {
      return "🌐";
    }

    return String.fromCodePoint(...[...normalized].map((char) => 127397 + char.charCodeAt(0)));
  };

  const normalizeGeo = ({ ip, country, countryCode }) => {
    const safeIp = String(ip || "").trim() || "Unknown";
    const safeCountry = String(country || "").trim() || "Unknown";
    const safeCode = String(countryCode || "").trim().toUpperCase() || "--";

    return {
      ip: safeIp,
      country: safeCountry,
      countryCode: safeCode,
      flag: flagFromCode(safeCode),
    };
  };

  const fetchJsonWithTimeout = async (url, timeoutMs) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Geo lookup failed (${response.status})`);
      }
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  };

  const detectDevice = () => {
    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

    let browser = "Unknown";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
    else if (/Firefox\//.test(ua)) browser = "Firefox";

    return `${isMobile ? "Mobile" : "Desktop"} • ${browser}`;
  };

  const fetchGeo = async () => {
    try {
      const providers = [
        async () => {
          const data = await fetchJsonWithTimeout("https://ipapi.co/json/", 3000);
          return normalizeGeo({
            ip: data.ip,
            country: data.country_name,
            countryCode: data.country_code,
          });
        },
        async () => {
          const data = await fetchJsonWithTimeout("https://ipwho.is/", 3000);
          return normalizeGeo({
            ip: data.ip,
            country: data.country,
            countryCode: data.country_code,
          });
        },
      ];

      for (const provider of providers) {
        try {
          const geo = await provider();
          if (String(geo.ip || "").toLowerCase() !== "unknown") {
            return geo;
          }
        } catch {
          // Try next provider.
        }
      }

      throw new Error("All geo providers failed");
    } catch {
      return {
        ip: "Unknown",
        country: "Unknown",
        countryCode: "--",
        flag: "🌐",
      };
    }
  };

  const trackView = async () => {
    const route = String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
    const routeToLegacyPath = {
      "/": "index.html",
      "/contact": "contact-adham.html",
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

    const geo = await fetchGeo();
    const entry = {
      timestamp: new Date().toISOString(),
      path,
      ip: geo.ip,
      country: geo.country,
      countryCode: geo.countryCode,
      flag: geo.flag,
      device: detectDevice(),
      userAgent: navigator.userAgent,
    };

    const analyticsPayload = JSON.stringify({
      action: "track",
      entry,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([analyticsPayload], { type: "application/json" });
      navigator.sendBeacon(ANALYTICS_API_URL, blob);
    } else {
      await fetch(ANALYTICS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: analyticsPayload,
      });
    }

    lastTracked = { path, timestamp: Date.now() };
  };

  trackView();
})();
