(function () {
  const VIEW_LOGS_KEY = "imperium_view_logs";
  const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");
  const ANALYTICS_API_URL = `${API_BASE}/analytics`;
  const GEO_CACHE_KEY = "imperium_geo_cache";
  const GEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const LAST_VIEW_KEY = "imperium_last_view";
  const DEDUPE_WINDOW_MS = 2000;

  const readLogs = () => {
    try {
      const raw = localStorage.getItem(VIEW_LOGS_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeLogs = (logs) => {
    localStorage.setItem(VIEW_LOGS_KEY, JSON.stringify(logs.slice(0, 1000)));
  };

  const readGeoCache = () => {
    try {
      const raw = localStorage.getItem(GEO_CACHE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      if (!parsed.savedAt || Date.now() - parsed.savedAt > GEO_CACHE_TTL_MS) {
        return null;
      }

      if (parsed.geo && String(parsed.geo.ip || "").trim().toLowerCase() === "unknown") {
        return null;
      }

      return parsed.geo || null;
    } catch {
      return null;
    }
  };

  const writeGeoCache = (geo) => {
    if (!geo || String(geo.ip || "").toLowerCase() === "unknown") {
      return;
    }

    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      geo,
    }));
  };

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
    const cached = readGeoCache();
    if (cached) {
      return cached;
    }

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
            writeGeoCache(geo);
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
    const path = window.location.pathname.split("/").pop() || "index.html";

    try {
      const rawLastView = localStorage.getItem(LAST_VIEW_KEY);
      const parsedLastView = rawLastView ? JSON.parse(rawLastView) : null;
      if (
        parsedLastView
        && parsedLastView.path === path
        && typeof parsedLastView.timestamp === "number"
        && Date.now() - parsedLastView.timestamp < DEDUPE_WINDOW_MS
      ) {
        return;
      }
    } catch {
      // Ignore malformed dedupe metadata and proceed.
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

    try {
      const analyticsPayload = JSON.stringify({
        action: "track",
        entry,
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([analyticsPayload], { type: "application/json" });
        const accepted = navigator.sendBeacon(ANALYTICS_API_URL, blob);
        if (!accepted) {
          throw new Error("Beacon not accepted");
        }
      } else {
        const response = await fetch(ANALYTICS_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          keepalive: true,
          body: analyticsPayload,
        });

        if (!response.ok) {
          throw new Error("Remote analytics unavailable");
        }
      }
    } catch {
      // Keep local fallback so analytics still work when function is unavailable.
      const logs = readLogs();
      logs.unshift(entry);
      writeLogs(logs);
    }

    localStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ path, timestamp: Date.now() }));
  };

  trackView();
})();
