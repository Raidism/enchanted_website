(function () {
  const VIEW_LOGS_KEY = "imperium_view_logs";
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

      return parsed.geo || null;
    } catch {
      return null;
    }
  };

  const writeGeoCache = (geo) => {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      geo,
    }));
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const response = await fetch("https://ipapi.co/json/", { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error("Geo lookup failed");
      }

      const data = await response.json();
      const geo = {
        ip: data.ip || "Unknown",
        country: data.country_name || "Unknown",
        countryCode: data.country_code || "--",
        flag: data.country_code ? String.fromCodePoint(...[...data.country_code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "🏳️",
      };

      writeGeoCache(geo);
      return geo;
    } catch {
      return {
        ip: "Unknown",
        country: "Unknown",
        countryCode: "--",
        flag: "🏳️",
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
    const logs = readLogs();

    logs.unshift({
      timestamp: new Date().toISOString(),
      path,
      ip: geo.ip,
      country: geo.country,
      countryCode: geo.countryCode,
      flag: geo.flag,
      device: detectDevice(),
      userAgent: navigator.userAgent,
    });

    writeLogs(logs);
    localStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ path, timestamp: Date.now() }));
  };

  trackView();
})();
