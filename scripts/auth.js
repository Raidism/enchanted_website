(function () {
  const API_BASE = String((window.ImperiumRuntime && window.ImperiumRuntime.apiBase) || "/api").replace(/\/+$/, "");
  const SITE_SETTINGS_STORAGE_KEY = "imperium_site_settings";
  let cachedUser = null;
  let cachedSettings = null;

  const broadcastSiteSettings = (settings) => {
    try {
      localStorage.setItem(SITE_SETTINGS_STORAGE_KEY, JSON.stringify(settings || {}));
    } catch {
      // Ignore storage write errors (private mode/quota).
    }

    try {
      window.dispatchEvent(new CustomEvent("imperium:site-settings-updated", { detail: { settings: settings || {} } }));
    } catch {
      // Ignore event dispatch errors.
    }
  };

  const parseJsonSafe = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const normalizeProfileKey = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const PROFILE_FALLBACKS = {
    joumohd08: {
      name: "Joumana Mohamed",
      photo: "assets/Joumana Mohamed .png",
    },
    y72n_e: {
      name: "Yassin elnaggar",
      photo: "assets/Yassin elnaggar.jpg",
    },
  };

  const applyUserFallbackProfile = (user) => {
    if (!user || typeof user !== "object") return user;
    const key = normalizeProfileKey(user.username);
    const mapped = PROFILE_FALLBACKS[key];
    if (!mapped) return user;

    return {
      ...user,
      name: String(mapped.name || user.name || ""),
      photo: String(mapped.photo || user.photo || ""),
    };
  };

  const requestSync = (method, path, body) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${path}`, false);
    xhr.setRequestHeader("Accept", "application/json");
    if (body !== undefined) {
      xhr.setRequestHeader("Content-Type", "application/json");
    }

    try {
      xhr.send(body === undefined ? null : JSON.stringify(body));
      const payload = parseJsonSafe(xhr.responseText || "");
      return {
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        payload,
      };
    } catch {
      return {
        ok: false,
        status: 0,
        payload: null,
      };
    }
  };

  const requestAsync = async (method, path, body) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  };

  const ensureCurrentUser = () => {
    if (cachedUser) {
      return cachedUser;
    }

    const result = requestSync("GET", "/auth/me");
    if (result.ok && result.payload && result.payload.user) {
      cachedUser = applyUserFallbackProfile(result.payload.user);
      return cachedUser;
    }

    cachedUser = null;
    return null;
  };

  const ensureSiteSettings = () => {
    if (cachedSettings) {
      return cachedSettings;
    }

    const result = requestSync("GET", "/site-settings");
    if (result.ok && result.payload && result.payload.settings) {
      cachedSettings = result.payload.settings;
      return cachedSettings;
    }

    cachedSettings = {
      maintenanceMode: false,
      maintenanceMessage: "Imperium MUN is temporarily under maintenance. Please check back soon.",
      launchDate: "2026-03-28T00:00:00+03:00",
      announcement: "",
      teamApplicationsOpen: false,
      applicationsOpen: false,
      conferenceDate: "2026-05-15T09:00:00+03:00",
      locationText: "Riyadh, Saudi Arabia",
      conferenceDescription: "Imperium MUN is a student-led conference focused on collaboration, critical thinking, and impactful debate.",
      countdownEnabled: true,
      instagramStatsSource: "live",
      instagramFollowers: 487,
      instagramPosts: 18,
      instagramFollowing: 4,
    };

    return cachedSettings;
  };

  const init = () => {
    ensureSiteSettings();
    ensureCurrentUser();
  };

  const login = (usernameInput, passwordInput) => {
    const username = String(usernameInput || "").trim();
    const password = String(passwordInput || "");
    const result = requestSync("POST", "/auth/login", { username, password });

    if (!result.ok || !result.payload || !result.payload.success) {
      return {
        success: false,
        message: result.payload && result.payload.message ? result.payload.message : "Wrong username or password.",
      };
    }

    cachedUser = result.payload.user || null;
    cachedUser = applyUserFallbackProfile(cachedUser);
    cachedSettings = null;

    return {
      success: true,
      user: cachedUser,
    };
  };

  const logout = () => {
    requestSync("POST", "/auth/logout");
    cachedUser = null;
  };

  const heartbeat = () => {
    requestAsync("POST", "/auth/heartbeat").catch(() => {
      // Ignore background heartbeat errors.
    });
  };

  const addUser = (_creator, usernameInput, passwordInput, roleInput) => {
    const username = String(usernameInput || "").trim();
    const password = String(passwordInput || "").trim();
    const role = String(roleInput || "member").trim();

    const result = requestSync("POST", "/users", {
      username,
      password,
      role,
    });

    if (!result.ok || !result.payload) {
      return {
        success: false,
        message: result.payload && result.payload.message ? result.payload.message : "Failed to add user.",
      };
    }

    return {
      success: Boolean(result.payload.success),
      message: String(result.payload.message || "User added successfully."),
    };
  };

  const getUsers = () => {
    const result = requestSync("GET", "/users");
    if (!result.ok || !result.payload || !Array.isArray(result.payload.users)) {
      return [];
    }
    return result.payload.users;
  };

  const getUsersForAdmin = () => getUsers();

  const getCurrentUser = () => ensureCurrentUser();

  const getActiveUsers = () => {
    const result = requestSync("GET", "/sessions/active");
    if (!result.ok || !result.payload || typeof result.payload.activeUsers !== "object") {
      return {};
    }
    return result.payload.activeUsers;
  };

  const getLoginHistory = () => {
    const result = requestSync("GET", "/auth/history");
    if (!result.ok || !result.payload || !Array.isArray(result.payload.rows)) {
      return [];
    }
    return result.payload.rows;
  };

  const getSiteSettings = () => ensureSiteSettings();

  const updateSiteSettings = (_creator, updates) => {
    if (!updates || typeof updates !== "object") {
      return { success: false, message: "Invalid settings payload." };
    }

    const result = requestSync("PUT", "/site-settings", updates);
    if (!result.ok || !result.payload) {
      return {
        success: false,
        message: result.payload && result.payload.message ? result.payload.message : "Failed to update site settings.",
      };
    }

    if (result.payload.settings) {
      cachedSettings = result.payload.settings;
    } else {
      cachedSettings = null;
    }

    if (cachedSettings) {
      broadcastSiteSettings(cachedSettings);
    }

    return {
      success: Boolean(result.payload.success),
      message: String(result.payload.message || "Site settings updated."),
      settings: result.payload.settings,
    };
  };

  const setUserDisabled = (_creator, usernameInput, disabledInput) => {
    const result = requestSync("POST", "/users/disable", {
      username: String(usernameInput || "").trim(),
      disabled: Boolean(disabledInput),
    });

    if (!result.ok || !result.payload) {
      return {
        success: false,
        message: result.payload && result.payload.message ? result.payload.message : "Failed to update user access.",
      };
    }

    return {
      success: Boolean(result.payload.success),
      message: String(result.payload.message || "User access updated."),
    };
  };

  const forceLogoutUser = (_creator, usernameInput) => {
    const result = requestSync("POST", "/users/force-logout", {
      username: String(usernameInput || "").trim(),
    });

    if (!result.ok || !result.payload) {
      return {
        success: false,
        message: result.payload && result.payload.message ? result.payload.message : "Failed to force logout user.",
      };
    }

    return {
      success: Boolean(result.payload.success),
      message: String(result.payload.message || "User force-logged out."),
    };
  };

  const getOnboardingStatus = () => {
    const result = requestSync("GET", "/auth/onboarding");
    if (!result.ok || !result.payload) {
      return {
        success: false,
        onboardingCompleted: Boolean(cachedUser && cachedUser.onboardingCompleted),
      };
    }

    const onboardingCompleted = Boolean(result.payload.onboardingCompleted);
    if (cachedUser) {
      cachedUser.onboardingCompleted = onboardingCompleted;
    }

    return {
      success: true,
      onboardingCompleted,
    };
  };

  const completeOnboarding = () => {
    const result = requestSync("POST", "/auth/onboarding/complete", {});
    if (!result.ok || !result.payload) {
      return {
        success: false,
        message: result.payload && result.payload.message ? result.payload.message : "Failed to save onboarding state.",
      };
    }

    if (cachedUser) {
      cachedUser.onboardingCompleted = true;
    }

    return {
      success: true,
      onboardingCompleted: true,
    };
  };

  init();

  window.ImperiumAuth = {
    init,
    login,
    logout,
    heartbeat,
    addUser,
    getUsers,
    getUsersForAdmin,
    getCurrentUser,
    getActiveUsers,
    getLoginHistory,
    getSiteSettings,
    updateSiteSettings,
    setUserDisabled,
    forceLogoutUser,
    getOnboardingStatus,
    completeOnboarding,
  };
})();
