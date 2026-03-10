(function () {
  const USERS_KEY = "imperium_users";
  const CURRENT_USER_KEY = "imperium_current_user";
  const ACTIVE_USERS_KEY = "imperium_active_users";
  const LOGIN_HISTORY_KEY = "imperium_login_history";
  const SITE_SETTINGS_KEY = "imperium_site_settings";
  const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

  const defaultAdminUser = { username: "admin", password: "Soliman123@", role: "admin", name: "Adham Soliman", photo: "assets/adham pic.jpg" };
  const defaultMemberUser = { username: "everyone", password: "123", role: "member", name: "", photo: "" };
  const defaultUsgAdminUser = { username: "ln-obidat", password: "3004", role: "admin", name: "Leen Obeidat", photo: "assets/under secretary general.png" };
  const defaultSgAdminUser = { username: "AhmadPh", password: "Ahmadggg", role: "admin", name: "Ahmed Pharaon", photo: "assets/secretary general.png" };
  const defaultMediaMemberUser = { username: "Toleenkmedia", password: "Totakordi10", role: "member", name: "Toleen Kurdi", photo: "assets/head of media.png" };
  const defaultUsers = [
    defaultAdminUser,
    defaultMemberUser,
    defaultUsgAdminUser,
    defaultSgAdminUser,
    defaultMediaMemberUser,
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
  const isMainAdminUser = (user) => normalizeUsername(user && user.username) === "admin";

  const getSessionExpiryIso = (session) => {
    if (!session || typeof session !== "object") {
      return "";
    }

    const explicit = String(session.expiresAt || "").trim();
    if (explicit) {
      return explicit;
    }

    const loginAt = new Date(String(session.loginAt || ""));
    if (Number.isNaN(loginAt.getTime())) {
      return "";
    }

    return new Date(loginAt.getTime() + SESSION_DURATION_MS).toISOString();
  };

  const isExpiredSession = (session) => {
    const expiryIso = getSessionExpiryIso(session);
    if (!expiryIso) {
      return false;
    }

    const expiryDate = new Date(expiryIso);
    if (Number.isNaN(expiryDate.getTime())) {
      return false;
    }

    return Date.now() >= expiryDate.getTime();
  };

  const init = () => {
    const users = readJson(USERS_KEY, null);
    if (!Array.isArray(users) || users.length === 0) {
      writeJson(USERS_KEY, defaultUsers);
    } else {
      const existingUsers = [...users];
      const adminIndex = existingUsers.findIndex((user) => normalizeUsername(user.username) === "admin");
      const everyoneIndex = existingUsers.findIndex((user) => normalizeUsername(user.username) === "everyone");
      const usgIndex = existingUsers.findIndex((user) => normalizeUsername(user.username) === normalizeUsername(defaultUsgAdminUser.username));
      const sgIndex = existingUsers.findIndex((user) => normalizeUsername(user.username) === normalizeUsername(defaultSgAdminUser.username));
      const mediaIndex = existingUsers.findIndex((user) => normalizeUsername(user.username) === normalizeUsername(defaultMediaMemberUser.username));

      if (adminIndex === -1) {
        existingUsers.push(defaultAdminUser);
      } else {
        existingUsers[adminIndex] = {
          ...existingUsers[adminIndex],
          username: "admin",
          password: defaultAdminUser.password,
          role: "admin",
          name: defaultAdminUser.name,
          photo: defaultAdminUser.photo,
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
          name: defaultMemberUser.name,
          photo: defaultMemberUser.photo,
        };
      }

      if (usgIndex === -1) {
        existingUsers.push(defaultUsgAdminUser);
      } else {
        existingUsers[usgIndex] = {
          ...existingUsers[usgIndex],
          username: defaultUsgAdminUser.username,
          password: defaultUsgAdminUser.password,
          role: "admin",
          name: defaultUsgAdminUser.name,
          photo: defaultUsgAdminUser.photo,
        };
      }

      if (sgIndex === -1) {
        existingUsers.push(defaultSgAdminUser);
      } else {
        existingUsers[sgIndex] = {
          ...existingUsers[sgIndex],
          username: defaultSgAdminUser.username,
          password: defaultSgAdminUser.password,
          role: "admin",
          name: defaultSgAdminUser.name,
          photo: defaultSgAdminUser.photo,
        };
      }

      if (mediaIndex === -1) {
        existingUsers.push(defaultMediaMemberUser);
      } else {
        existingUsers[mediaIndex] = {
          ...existingUsers[mediaIndex],
          username: defaultMediaMemberUser.username,
          password: defaultMediaMemberUser.password,
          role: "member",
          name: defaultMediaMemberUser.name,
          photo: defaultMediaMemberUser.photo,
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
    const session = readJson(CURRENT_USER_KEY, null);
    if (!session || typeof session !== "object") {
      return null;
    }

    if (isExpiredSession(session)) {
      const activeUsers = getActiveUsers();
      const username = String(session.username || "").trim();
      if (username && activeUsers[username]) {
        delete activeUsers[username];
        setActiveUsers(activeUsers);
      }
      localStorage.removeItem(CURRENT_USER_KEY);
      return null;
    }

    // Backfill expiry for old sessions so timeout behavior is consistent.
    const expiryIso = getSessionExpiryIso(session);
    if (expiryIso && !session.expiresAt) {
      const next = {
        ...session,
        expiresAt: expiryIso,
      };
      writeJson(CURRENT_USER_KEY, next);
      return next;
    }

    return session;
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
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
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
    const current = readJson(CURRENT_USER_KEY, null);
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
    if (!creator || creator.role !== "admin" || !isMainAdminUser(creator)) {
      return { success: false, message: "Only the main admin account can change user access." };
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
