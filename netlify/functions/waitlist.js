const { getStore } = require("@netlify/blobs");

const STORE_NAME = "imperium_waitlist";
const ENTRIES_KEY = "entries";
const DELETED_ENTRIES_KEY = "deleted_entries";
const VALID_STATUSES = new Set(["pending", "green", "red", "saved"]);

const BLOBS_SITE_ID = String(
  process.env.NETLIFY_SITE_ID
    || process.env.SITE_ID
    || process.env.BLOBS_SITE_ID
    || ""
).trim();

const BLOBS_TOKEN = String(
  process.env.NETLIFY_AUTH_TOKEN
    || process.env.NETLIFY_API_TOKEN
    || process.env.BLOBS_TOKEN
    || ""
).trim();

const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(payload),
});

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getWaitlistStore = () => {
  if (!BLOBS_SITE_ID || !BLOBS_TOKEN) {
    const siteIdPresent = Boolean(BLOBS_SITE_ID);
    const tokenPresent = Boolean(BLOBS_TOKEN);
    throw new Error(
      `Missing Netlify Blobs credentials (BLOBS_SITE_ID present: ${siteIdPresent}, BLOBS_TOKEN present: ${tokenPresent}). Add both env vars in Netlify and redeploy.`
    );
  }

  try {
    // Support both SDK signatures across @netlify/blobs versions.
    try {
      return getStore({
        name: STORE_NAME,
        siteID: BLOBS_SITE_ID,
        token: BLOBS_TOKEN,
      });
    } catch {
      return getStore(STORE_NAME, {
        siteID: BLOBS_SITE_ID,
        token: BLOBS_TOKEN,
      });
    }
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (message.toLowerCase().includes("not been configured to use netlify blobs")) {
      throw new Error(
        "Netlify Blobs is not configured. Add BLOBS_SITE_ID and BLOBS_TOKEN (or NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN) in Netlify environment variables."
      );
    }

    throw error;
  }
};

const ensureEntryShape = (entry) => {
  const status = VALID_STATUSES.has(String(entry.status || "").trim())
    ? String(entry.status).trim()
    : "pending";

  return {
    id: String(entry.id || newId()),
    name: String(entry.name || "").trim(),
    email: normalizeEmail(entry.email),
    school: String(entry.school || "").trim(),
    role: String(entry.role || "delegate").trim(),
    addedAt: String(entry.addedAt || new Date().toISOString()),
    status,
    reviewedAt: entry.reviewedAt ? String(entry.reviewedAt) : "",
    reviewedBy: entry.reviewedBy ? String(entry.reviewedBy) : "",
    notified: Boolean(entry.notified),
    notifiedAt: entry.notifiedAt ? String(entry.notifiedAt) : "",
  };
};

const ensureDeletedEntryShape = (entry) => {
  const base = ensureEntryShape(entry || {});
  return {
    ...base,
    deletedAt: String(entry && entry.deletedAt ? entry.deletedAt : new Date().toISOString()),
    deletedBy: String(entry && entry.deletedBy ? entry.deletedBy : ""),
  };
};

const readEntries = async () => {
  const store = getWaitlistStore();
  const rows = await store.get(ENTRIES_KEY, { type: "json" });
  return Array.isArray(rows) ? rows.map(ensureEntryShape) : [];
};

const readDeletedEntries = async () => {
  const store = getWaitlistStore();
  const rows = await store.get(DELETED_ENTRIES_KEY, { type: "json" });
  return Array.isArray(rows) ? rows.map(ensureDeletedEntryShape) : [];
};

const writeEntries = async (entries) => {
  const store = getWaitlistStore();
  await store.setJSON(ENTRIES_KEY, entries.slice(0, 3000));
};

const writeDeletedEntries = async (entries) => {
  const store = getWaitlistStore();
  await store.setJSON(DELETED_ENTRIES_KEY, entries.slice(0, 500));
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const entries = await readEntries();
      const deletedEntries = await readDeletedEntries();
      return json(200, { success: true, entries, deletedEntries });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { success: false, message: "Method not allowed." });
    }

    const payload = JSON.parse(event.body || "{}");
    const action = String(payload.action || "create").trim();

    const entries = await readEntries();
    const deletedEntries = await readDeletedEntries();

    if (action === "updateStatus") {
      const id = String(payload.id || "").trim();
      const status = String(payload.status || "").trim();
      const reviewedBy = String(payload.reviewedBy || "").trim();

      if (!id || !VALID_STATUSES.has(status)) {
        return json(400, { success: false, message: "Invalid status update payload." });
      }

      const index = entries.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return json(404, { success: false, message: "Entry not found." });
      }

      entries[index] = {
        ...entries[index],
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy,
      };

      await writeEntries(entries);
      return json(200, { success: true, message: "Status updated.", entries, deletedEntries });
    }

    if (action === "setNotified") {
      const id = String(payload.id || "").trim();
      const notified = Boolean(payload.notified);
      const reviewedBy = String(payload.reviewedBy || "").trim();
      if (!id) {
        return json(400, { success: false, message: "Entry id is required." });
      }

      const index = entries.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return json(404, { success: false, message: "Entry not found." });
      }

      entries[index] = {
        ...entries[index],
        notified,
        notifiedAt: notified ? new Date().toISOString() : "",
        reviewedAt: new Date().toISOString(),
        reviewedBy,
      };

      await writeEntries(entries);
      return json(200, { success: true, message: "Notification status updated.", entries, deletedEntries });
    }

    if (action === "notifyAll") {
      const reviewedBy = String(payload.reviewedBy || "").trim();
      const now = new Date().toISOString();
      const nextEntries = entries.map((entry) => ({
        ...entry,
        notified: true,
        notifiedAt: now,
        reviewedAt: now,
        reviewedBy,
      }));

      await writeEntries(nextEntries);
      return json(200, { success: true, message: "All entries marked as notified.", entries: nextEntries, deletedEntries });
    }

    if (action === "delete") {
      const id = String(payload.id || "").trim();
      const reviewedBy = String(payload.reviewedBy || "").trim();
      if (!id) {
        return json(400, { success: false, message: "Entry id is required." });
      }

      const removed = entries.find((entry) => entry.id === id);
      const filtered = entries.filter((entry) => entry.id !== id);
      if (!removed || filtered.length === entries.length) {
        return json(404, { success: false, message: "Entry not found." });
      }

      deletedEntries.unshift({
        ...removed,
        deletedAt: new Date().toISOString(),
        deletedBy: reviewedBy,
      });

      await writeEntries(filtered);
      await writeDeletedEntries(deletedEntries);
      return json(200, {
        success: true,
        message: "Entry deleted.",
        entries: filtered,
        deletedEntries,
      });
    }

    if (action === "restore") {
      const id = String(payload.id || "").trim();
      const reviewedBy = String(payload.reviewedBy || "").trim();
      if (!id) {
        return json(400, { success: false, message: "Deleted entry id is required." });
      }

      const deletedIndex = deletedEntries.findIndex((entry) => entry.id === id);
      if (deletedIndex === -1) {
        return json(404, { success: false, message: "Deleted entry not found." });
      }

      const [restored] = deletedEntries.splice(deletedIndex, 1);
      const restoredEntry = {
        ...ensureEntryShape(restored),
        reviewedAt: new Date().toISOString(),
        reviewedBy,
      };

      entries.unshift(restoredEntry);

      await writeEntries(entries);
      await writeDeletedEntries(deletedEntries);
      return json(200, {
        success: true,
        message: "Entry restored.",
        entries,
        deletedEntries,
      });
    }

    if (action !== "create") {
      return json(400, { success: false, message: "Unsupported action." });
    }

    const name = String(payload.name || "").trim();
    const email = normalizeEmail(payload.email);
    const school = String(payload.school || "").trim();
    const role = String(payload.role || "delegate").trim();

    if (!name || !email || !school || !role) {
      return json(400, { success: false, message: "Missing required fields." });
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      return json(400, { success: false, message: "Invalid email format." });
    }

    const exists = entries.some((entry) => normalizeEmail(entry.email) === email);
    if (exists) {
      return json(409, { success: false, message: "Email already registered.", entries });
    }

    entries.unshift({
      id: newId(),
      name,
      email,
      school,
      role,
      addedAt: new Date().toISOString(),
      status: "pending",
      reviewedAt: "",
      reviewedBy: "",
      notified: false,
      notifiedAt: "",
    });

    await writeEntries(entries);
    return json(200, { success: true, message: "Saved.", entries, deletedEntries });
  } catch (error) {
    return json(500, {
      success: false,
      message: "Server error while processing waitlist.",
      error: String(error && error.message ? error.message : error),
    });
  }
};
