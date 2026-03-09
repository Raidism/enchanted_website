(function () {
  const USERS_KEY = "imperium_users";
  const CURRENT_USER_KEY = "imperium_current_user";
  const ACTIVE_USERS_KEY = "imperium_active_users";
  const LOGIN_HISTORY_KEY = "imperium_login_history";
  const SITE_SETTINGS_KEY = "imperium_site_settings";

  const defaultAdminUser = { username: "admin", password: "Soliman123@", role: "admin" };
  const defaultMemberUser = { username: "everyone", password: "123", role: "member" };
  const defaultUsers = [
    defaultAdminUser,
    defaultMemberUser,
  ];

  const defaultSiteSettings = {
    maintenanceMode: false,
    maintenanceMessage: "Imperium MUN is temporarily under maintenance. Please check back soon.",
    launchDate: "2026-03-28T00:00:00+03:00",
    announcement: "",
  };

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

  const init = () => {
    const users = readJson(USERS_KEY, null);
    if (!Array.isArray(users) || users.length === 0) {
      writeJson(USERS_KEY, defaultUsers);
    } else {
      const existingUsers = [...users];
      const adminIndex = existingUsers.findIndex((user) => normalizeUsername(user.username) === "admin");
      const everyoneIndex = existingUsers.findIndex((user) => normalizeUsername(user.username) === "everyone");

      if (adminIndex === -1) {
        existingUsers.push(defaultAdminUser);
      } else {
        existingUsers[adminIndex] = {
          ...existingUsers[adminIndex],
          username: "admin",
          password: defaultAdminUser.password,
          role: "admin",
        };
      }

      if (everyoneIndex === -1) {
        existingUsers.push(defaultMemberUser);
      } else {
        existingUsers[everyoneIndex] = {
          ...existingUsers[everyoneIndex],
          username: "everyone",
          password: defaultMemberUser.password,
          role: "member",
        };
      }

      writeJson(USERS_KEY, existingUsers);
    }

    const activeUsers = readJson(ACTIVE_USERS_KEY, null);
    if (!activeUsers || typeof activeUsers !== "object") {
      writeJson(ACTIVE_USERS_KEY, {});
    }

    const history = readJson(LOGIN_HISTORY_KEY, null);
    if (!Array.isArray(history)) {
      writeJson(LOGIN_HISTORY_KEY, []);
    }

    const siteSettings = readJson(SITE_SETTINGS_KEY, null);
    if (!siteSettings || typeof siteSettings !== "object") {
      writeJson(SITE_SETTINGS_KEY, defaultSiteSettings);
    } else {
      writeJson(SITE_SETTINGS_KEY, {
        ...defaultSiteSettings,
        ...siteSettings,
      });
    }
  };

  const getUsers = () => {
    init();
    return readJson(USERS_KEY, defaultUsers);
  };

  const getCurrentUser = () => {
    init();
    return readJson(CURRENT_USER_KEY, null);
  };

  const setCurrentUser = (user) => {
    writeJson(CURRENT_USER_KEY, user);
  };

  const getActiveUsers = () => {
    init();
    return readJson(ACTIVE_USERS_KEY, {});
  };

  const setActiveUsers = (value) => {
    writeJson(ACTIVE_USERS_KEY, value);
  };

  const addLoginHistory = (entry) => {
    const history = readJson(LOGIN_HISTORY_KEY, []);
    history.unshift(entry);
    writeJson(LOGIN_HISTORY_KEY, history.slice(0, 250));
  };

  const heartbeat = () => {
    const current = getCurrentUser();
    if (!current) {
      return;
    }

    const activeUsers = getActiveUsers();
    if (!activeUsers[current.username]) {
      activeUsers[current.username] = {
        username: current.username,
        role: current.role,
        loginAt: new Date().toISOString(),
      };
    }
    activeUsers[current.username].lastSeenAt = new Date().toISOString();
    setActiveUsers(activeUsers);
  };

  const login = (usernameInput, passwordInput) => {
    init();

    const usernameNormalized = normalizeUsername(usernameInput);
    const password = String(passwordInput || "");
    const users = getUsers();

    const matched = users.find((user) => normalizeUsername(user.username) === usernameNormalized);

    if (!matched || matched.password !== password) {
      return { success: false, message: "Wrong username or password." };
    }

    if (matched.disabled) {
      return { success: false, message: "This account is disabled. Contact admin." };
    }

    const siteSettings = getSiteSettings();
    if (siteSettings.maintenanceMode && (matched.role || "member") !== "admin") {
      return {
        success: false,
        message: siteSettings.maintenanceMessage || "Website is under maintenance. Please try again later.",
      };
    }

    const current = {
      username: matched.username,
      role: matched.role || "member",
      loginAt: new Date().toISOString(),
    };

    setCurrentUser(current);
    heartbeat();
    addLoginHistory({
      username: current.username,
      role: current.role,
      loginAt: current.loginAt,
    });

    return { success: true, user: current };
  };

  const logout = () => {
    const current = getCurrentUser();
    if (current) {
      const activeUsers = getActiveUsers();
      delete activeUsers[current.username];
      setActiveUsers(activeUsers);
    }
    localStorage.removeItem(CURRENT_USER_KEY);
  };

  const addUser = (creator, usernameInput, passwordInput, roleInput) => {
    if (!creator || creator.role !== "admin") {
      return { success: false, message: "Only admin can add users." };
    }

    const username = String(usernameInput || "").trim();
    const password = String(passwordInput || "").trim();
    const role = String(roleInput || "member").trim().toLowerCase() === "admin" ? "admin" : "member";

    if (!username || !password) {
      return { success: false, message: "Username and password are required." };
    }

    const users = getUsers();
    const exists = users.some((user) => normalizeUsername(user.username) === normalizeUsername(username));
    if (exists) {
      return { success: false, message: "Username already exists." };
    }

    users.push({ username, password, role, disabled: false });
    writeJson(USERS_KEY, users);
    return { success: true, message: "User added successfully." };
  };

  const getSafeUsers = () => getUsers().map((user) => ({
    username: user.username,
    role: user.role || "member",
    disabled: Boolean(user.disabled),
  }));

  const getLoginHistory = () => readJson(LOGIN_HISTORY_KEY, []);

  const getSiteSettings = () => {
    init();
    return readJson(SITE_SETTINGS_KEY, defaultSiteSettings);
  };

  const updateSiteSettings = (creator, updates) => {
    if (!creator || creator.role !== "admin") {
      return { success: false, message: "Only admin can change site settings." };
    }

    if (!updates || typeof updates !== "object") {
      return { success: false, message: "Invalid settings payload." };
    }

    const current = getSiteSettings();
    const next = {
      ...current,
      ...updates,
    };

    next.maintenanceMode = Boolean(next.maintenanceMode);
    next.maintenanceMessage = String(next.maintenanceMessage || defaultSiteSettings.maintenanceMessage).trim();
    if (!next.maintenanceMessage) {
      next.maintenanceMessage = defaultSiteSettings.maintenanceMessage;
    }

    next.launchDate = String(next.launchDate || defaultSiteSettings.launchDate).trim();
    next.announcement = String(next.announcement || "").trim();

    writeJson(SITE_SETTINGS_KEY, next);
    return { success: true, message: "Site settings updated.", settings: next };
  };

  const setUserDisabled = (creator, usernameInput, disabledInput) => {
    if (!creator || creator.role !== "admin") {
      return { success: false, message: "Only admin can change user access." };
    }

    const targetUsername = String(usernameInput || "").trim();
    if (!targetUsername) {
      return { success: false, message: "Username is required." };
    }

    const users = getUsers();
    const index = users.findIndex((user) => normalizeUsername(user.username) === normalizeUsername(targetUsername));
    if (index === -1) {
      return { success: false, message: "User not found." };
    }

    if (normalizeUsername(users[index].username) === "admin") {
      return { success: false, message: "Admin access cannot be disabled." };
    }

    users[index] = {
      ...users[index],
      disabled: Boolean(disabledInput),
    };

    writeJson(USERS_KEY, users);

    if (Boolean(disabledInput)) {
      const activeUsers = getActiveUsers();
      delete activeUsers[users[index].username];
      setActiveUsers(activeUsers);
    }

    return {
      success: true,
      message: `User ${users[index].username} ${Boolean(disabledInput) ? "disabled" : "enabled"}.`,
    };
  };

  init();

  window.ImperiumAuth = {
    init,
    login,
    logout,
    heartbeat,
    addUser,
    getUsers: getSafeUsers,
    getCurrentUser,
    getActiveUsers,
    getLoginHistory,
    getSiteSettings,
    updateSiteSettings,
    setUserDisabled,
  };
})();
