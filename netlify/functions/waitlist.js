const { getStore } = require("@netlify/blobs");

const STORE_NAME = "imperium_waitlist";
const ENTRIES_KEY = "entries";
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
    return getStore(STORE_NAME, {
      siteID: BLOBS_SITE_ID,
      token: BLOBS_TOKEN,
    });
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
  };
};

const readEntries = async () => {
  const store = getWaitlistStore();
  const rows = await store.get(ENTRIES_KEY, { type: "json" });
  return Array.isArray(rows) ? rows.map(ensureEntryShape) : [];
};

const writeEntries = async (entries) => {
  const store = getWaitlistStore();
  await store.setJSON(ENTRIES_KEY, entries.slice(0, 3000));
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const entries = await readEntries();
      return json(200, { success: true, entries });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { success: false, message: "Method not allowed." });
    }

    const payload = JSON.parse(event.body || "{}");
    const action = String(payload.action || "create").trim();

    const entries = await readEntries();

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
      return json(200, { success: true, message: "Status updated.", entries });
    }

    if (action === "delete") {
      const id = String(payload.id || "").trim();
      if (!id) {
        return json(400, { success: false, message: "Entry id is required." });
      }

      const filtered = entries.filter((entry) => entry.id !== id);
      if (filtered.length === entries.length) {
        return json(404, { success: false, message: "Entry not found." });
      }

      await writeEntries(filtered);
      return json(200, { success: true, message: "Entry deleted.", entries: filtered });
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
    });

    await writeEntries(entries);
    return json(200, { success: true, message: "Saved.", entries });
  } catch (error) {
    return json(500, {
      success: false,
      message: "Server error while processing waitlist.",
      error: String(error && error.message ? error.message : error),
    });
  }
};
