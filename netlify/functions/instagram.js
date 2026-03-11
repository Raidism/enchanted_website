const DEFAULT_USERNAME = "imperiummun26";
const CACHE_SECONDS = 60 * 30;

const FALLBACK_STATS = {
  followers: 487,
  following: 4,
  posts: 18,
};

const baseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (statusCode, payload) => ({
  statusCode,
  headers: baseHeaders,
  body: JSON.stringify(payload),
});

const readCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return Math.floor(numeric);
};

const normalizeStats = (raw) => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const followers = readCount(raw.followers);
  const following = readCount(raw.following);
  const posts = readCount(raw.posts);

  if (followers === null || following === null || posts === null) {
    return null;
  }

  return { followers, following, posts };
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const fromWebProfileApi = async (username) => {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "X-IG-App-ID": "936619743392459",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`web_profile_info returned ${response.status}`);
  }

  const payload = await response.json();
  const user = payload && payload.data && payload.data.user;
  const stats = normalizeStats({
    followers: user && user.edge_followed_by && user.edge_followed_by.count,
    following: user && user.edge_follow && user.edge_follow.count,
    posts: user && user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.count,
  });

  if (!stats) {
    throw new Error("web_profile_info payload missing counts");
  }

  return { source: "web_profile_info", ...stats };
};

const fromLegacyQuery = async (username) => {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`;
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`legacy query returned ${response.status}`);
  }

  const payload = await response.json();
  const user = payload && payload.graphql && payload.graphql.user;
  const stats = normalizeStats({
    followers: user && user.edge_followed_by && user.edge_followed_by.count,
    following: user && user.edge_follow && user.edge_follow.count,
    posts: user && user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.count,
  });

  if (!stats) {
    throw new Error("legacy query payload missing counts");
  }

  return { source: "legacy_query", ...stats };
};

const extractByRegex = (source, regex) => {
  const match = source.match(regex);
  if (!match || !match[1]) {
    return null;
  }
  return readCount(match[1]);
};

const fromProfileHtml = async (username) => {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`profile html returned ${response.status}`);
  }

  const html = await response.text();
  const followers = extractByRegex(html, /"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
  const following = extractByRegex(html, /"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
  const posts = extractByRegex(html, /"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);

  const stats = normalizeStats({ followers, following, posts });
  if (!stats) {
    throw new Error("profile html missing counts");
  }

  return { source: "profile_html", ...stats };
};

const loadInstagramStats = async (username) => {
  const readers = [fromWebProfileApi, fromLegacyQuery, fromProfileHtml];

  for (const reader of readers) {
    try {
      const stats = await reader(username);
      if (stats) {
        return { success: true, stale: false, ...stats };
      }
    } catch {
      // Move to next strategy.
    }
  }

  return {
    success: true,
    stale: true,
    source: "fallback",
    ...FALLBACK_STATS,
  };
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: baseHeaders,
        body: "",
      };
    }

    if (event.httpMethod !== "GET") {
      return json(405, { success: false, message: "Method not allowed." });
    }

    const username = String((event.queryStringParameters && event.queryStringParameters.username) || DEFAULT_USERNAME)
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();

    if (!username) {
      return json(400, { success: false, message: "Username is required." });
    }

    const stats = await loadInstagramStats(username);

    return json(200, {
      ...stats,
      username,
      profileUrl: `https://www.instagram.com/${username}/`,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json(500, {
      success: false,
      message: "Server error while fetching Instagram stats.",
      error: String(error && error.message ? error.message : error),
      ...FALLBACK_STATS,
      stale: true,
      source: "error_fallback",
      username: DEFAULT_USERNAME,
      profileUrl: `https://www.instagram.com/${DEFAULT_USERNAME}/`,
      fetchedAt: new Date().toISOString(),
    });
  }
};
