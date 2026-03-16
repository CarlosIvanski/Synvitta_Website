const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const CONTACTS_STORAGE_PATH =
  process.env.CONTACTS_STORAGE_PATH || path.join(__dirname, "data", "contacts.jsonl");

// Ensure storage directory exists
fs.mkdirSync(path.dirname(CONTACTS_STORAGE_PATH), { recursive: true });

const ALLOWED_ORIGINS = [
  "https://www.synvittadiagnostics.com",
  "https://synvittadiagnostics.com",
  "https://app.synvittadiagnostics.com",
  "http://localhost:5173",
  "http://localhost:1010",
];

// Behind a single reverse proxy (Nginx Proxy Manager), trust first proxy hop
app.set("trust proxy", 1);

// Helmet with CSP that still allows the inline script used on /admin
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
      },
    },
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
  })
);

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { ok: false, error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
});

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function appendContactRecord(record) {
  const entry = JSON.stringify(record) + "\n";
  fs.appendFile(CONTACTS_STORAGE_PATH, entry, (err) => {
    if (err) {
      console.error("Failed to persist contact record:", err);
    }
  });
}

async function readContactRecords(limit = 200, offset = 0) {
  try {
    if (!fs.existsSync(CONTACTS_STORAGE_PATH)) {
      return [];
    }
    const raw = await fs.promises.readFile(CONTACTS_STORAGE_PATH, "utf8");
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const records = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      // most recent first
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return records.slice(offset, offset + limit);
  } catch (err) {
    console.error("Failed to read contact records:", err);
    return [];
  }
}

function getClientIp(req) {
  const xfwd = req.headers["x-forwarded-for"];
  if (typeof xfwd === "string" && xfwd.length > 0) {
    return xfwd.split(",")[0].trim();
  }
  return req.ip || null;
}

function requireAdmin(req, res, next) {
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;

  if (!adminUser || !adminPass) {
    console.error("ADMIN_USER or ADMIN_PASS not configured");
    return res.status(503).send("Admin interface is not configured.");
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Synvitta Admin"');
    return res.status(401).send("Authentication required.");
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const [user, pass] = decoded.split(":");

  if (user !== adminUser || pass !== adminPass) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Synvitta Admin"');
    return res.status(401).send("Invalid credentials.");
  }

  return next();
}

app.post("/api/contact", contactLimiter, async (req, res) => {
  try {
    const { name, company, email, interest, message } = req.body || {};

    const errors = [];
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push("Name is required");
    }
    if (!email || typeof email !== "string" || !validateEmail(email.trim())) {
      errors.push("Valid email is required");
    }
    if (!interest || typeof interest !== "string" || !interest.trim()) {
      errors.push("Area of interest is required");
    }

    if (errors.length > 0) {
      return res.status(400).json({ ok: false, error: errors.join("; ") });
    }

    const contactEmail = process.env.CONTACT_EMAIL;
    if (!contactEmail) {
      console.error("CONTACT_EMAIL is not configured");
      return res.status(500).json({ ok: false, error: "Server configuration error" });
    }

    const text = [
      `Name: ${(name || "").trim()}`,
      `Company: ${(company || "").trim() || "(not provided)"}`,
      `Email: ${(email || "").trim()}`,
      `Area of Interest: ${(interest || "").trim()}`,
      ``,
      `Message:`,
      (message || "").trim() || "(no message)",
    ].join("\n");

    const html = [
      `<p><strong>Name:</strong> ${escapeHtml((name || "").trim())}</p>`,
      `<p><strong>Company:</strong> ${escapeHtml((company || "").trim() || "(not provided)")}</p>`,
      `<p><strong>Email:</strong> <a href="mailto:${escapeHtml((email || "").trim())}">${escapeHtml((email || "").trim())}</a></p>`,
      `<p><strong>Area of Interest:</strong> ${escapeHtml((interest || "").trim())}</p>`,
      `<p><strong>Message:</strong></p>`,
      `<p>${escapeHtml((message || "").trim() || "(no message)").replace(/\n/g, "<br>")}</p>`,
    ].join("");

    let status = "pending";
    try {
      await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@synvittadiagnostics.com",
      to: contactEmail,
      replyTo: (email || "").trim(),
      subject: `[Synvitta Contact] ${(interest || "").trim()} – ${(name || "").trim()}`,
      text,
      html,
      });
      status = "sent";
    } catch (emailErr) {
      status = "smtp_error";
      console.error("Contact form email error:", emailErr);
      // continue; we still persist the record before returning error
    }

    const record = {
      createdAt: new Date().toISOString(),
      name: (name || "").trim(),
      email: (email || "").trim(),
      company: (company || "").trim(),
      interest: (interest || "").trim(),
      message: (message || "").trim(),
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || null,
      status,
    };
    appendContactRecord(record);

    if (status !== "sent") {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to send message. Please try again later." });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ ok: false, error: "Failed to send message. Please try again later." });
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "synvitta-forms" });
});

app.get("/api/admin/contacts", requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const items = await readContactRecords(limit, offset);
  res.json({ ok: true, items });
});

app.get("/admin", requireAdmin, (req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Synvitta Contacts</title>
    <style>
      :root {
        --bg: #0b1020;
        --card-bg: #0f172a;
        --border: rgba(148, 163, 184, 0.3);
        --accent: #38bdf8;
        --accent-soft: rgba(56, 189, 248, 0.12);
        --text: #e5e7eb;
        --text-soft: #9ca3af;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #0b1120 0, #020617 55%, #020617 100%);
        color: var(--text);
        min-height: 100vh;
      }
      .shell {
        max-width: 1120px;
        margin: 0 auto;
        padding: 32px 20px 40px;
      }
      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }
      h1 {
        font-size: 1.4rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        margin: 0;
      }
      .eyebrow {
        font-size: 0.75rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--text-soft);
        margin-bottom: 4px;
      }
      .meta {
        font-size: 0.8rem;
        color: var(--text-soft);
      }
      .card {
        border-radius: 16px;
        border: 1px solid var(--border);
        background:
          radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 55%),
          radial-gradient(circle at bottom right, rgba(129, 140, 248, 0.14), transparent 50%),
          rgba(15, 23, 42, 0.96);
        box-shadow:
          0 18px 40px rgba(15, 23, 42, 0.85),
          0 0 0 1px rgba(15, 23, 42, 0.9);
        overflow: hidden;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
      }
      thead {
        background: linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.9));
      }
      th, td {
        padding: 10px 12px;
        text-align: left;
        border-bottom: 1px solid rgba(15, 23, 42, 0.9);
      }
      th {
        font-weight: 500;
        color: var(--text-soft);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.13em;
      }
      tbody tr:nth-child(even) {
        background: rgba(15, 23, 42, 0.85);
      }
      tbody tr:hover {
        background: rgba(30, 64, 175, 0.55);
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.7rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .status-sent {
        background: rgba(34, 197, 94, 0.12);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.5);
      }
      .status-smtp_error {
        background: rgba(248, 113, 113, 0.12);
        color: #fca5a5;
        border: 1px solid rgba(248, 113, 113, 0.5);
      }
      .message-cell {
        max-width: 260px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .message-cell.full {
        white-space: normal;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 6px 11px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.45);
        background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 50%);
        color: var(--text);
        font-size: 0.78rem;
        cursor: pointer;
      }
      .btn span {
        font-size: 0.9em;
      }
      .btn:hover {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35);
      }
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.9);
        background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.14), transparent 55%);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: var(--text-soft);
      }
      .badge-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.32);
      }
      @media (max-width: 768px) {
        header {
          flex-direction: column;
          align-items: flex-start;
        }
        .shell {
          padding-inline: 16px;
        }
        table {
          font-size: 0.78rem;
        }
        th:nth-child(4),
        td:nth-child(4),
        th:nth-child(7),
        td:nth-child(7) {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div>
          <div class="eyebrow">Synvitta Diagnostics</div>
          <h1>Contact form activity</h1>
        </div>
        <div class="meta" id="meta-summary"></div>
      </header>
      <section class="card">
        <div class="toolbar">
          <div class="badge">
            <span class="badge-dot"></span>
            <span id="badge-text">Loading recent submissions…</span>
          </div>
          <button class="btn" id="refresh-btn" type="button">
            <span>⟲</span>
            <span>Refresh</span>
          </button>
        </div>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Interest</th>
                <th>Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="contacts-body">
              <tr><td colspan="7" style="padding:16px 12px;color:var(--text-soft);">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <script>
      function formatDate(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      function escapeHtml(str) {
        return String(str || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      async function loadContacts() {
        const tbody = document.getElementById("contacts-body");
        const badge = document.getElementById("badge-text");
        const meta = document.getElementById("meta-summary");
        tbody.innerHTML =
          '<tr><td colspan="7" style="padding:16px 12px;color:var(--text-soft);">Loading…</td></tr>';
        badge.textContent = "Loading recent submissions…";
        try {
          const res = await fetch("/api/admin/contacts?limit=200", { cache: "no-store" });
          if (!res.ok) throw new Error("Request failed with " + res.status);
          const data = await res.json();
          const items = Array.isArray(data.items) ? data.items : [];
          meta.textContent =
            items.length === 0
              ? "No submissions stored yet."
              : "Showing " + items.length + " most recent submission" + (items.length > 1 ? "s." : ".");
          badge.textContent = "Last updated: " + formatDate(new Date().toISOString());
          if (items.length === 0) {
            tbody.innerHTML =
              '<tr><td colspan="7" style="padding:16px 12px;color:var(--text-soft);">No submissions stored yet.</td></tr>';
            return;
          }
          tbody.innerHTML = "";
          for (const item of items) {
            const tr = document.createElement("tr");
            const email = escapeHtml(item.email || "");
            const message = item.message || "";
            const tdDate = document.createElement("td");
            tdDate.textContent = formatDate(item.createdAt);
            const tdName = document.createElement("td");
            tdName.textContent = item.name || "";
            const tdEmail = document.createElement("td");
            if (email) {
              const a = document.createElement("a");
              a.href = "mailto:" + email;
              a.textContent = email;
              a.style.color = "#bfdbfe";
              a.style.textDecoration = "none";
              a.onmouseover = () => (a.style.textDecoration = "underline");
              a.onmouseout = () => (a.style.textDecoration = "none");
              tdEmail.appendChild(a);
            }
            const tdCompany = document.createElement("td");
            tdCompany.textContent = item.company || "";
            const tdInterest = document.createElement("td");
            tdInterest.textContent = item.interest || "";
            const tdMessage = document.createElement("td");
            tdMessage.className = "message-cell";
            tdMessage.title = message || "";
            tdMessage.textContent = message || "";
            const tdStatus = document.createElement("td");
            const pill = document.createElement("span");
            pill.className = "status-pill " + (item.status === "sent" ? "status-sent" : "status-smtp_error");
            pill.textContent = (item.status || "unknown").replace("_", " ");
            tdStatus.appendChild(pill);
            tr.appendChild(tdDate);
            tr.appendChild(tdName);
            tr.appendChild(tdEmail);
            tr.appendChild(tdCompany);
            tr.appendChild(tdInterest);
            tr.appendChild(tdMessage);
            tr.appendChild(tdStatus);
            tbody.appendChild(tr);
          }
        } catch (err) {
          console.error(err);
          badge.textContent = "Failed to load submissions.";
          tbody.innerHTML =
            '<tr><td colspan="7" style="padding:16px 12px;color:#fecaca;">Failed to load submissions.</td></tr>';
        }
      }

      document.getElementById("refresh-btn").addEventListener("click", () => {
        loadContacts();
      });

      loadContacts();
    </script>
  </body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Synvitta Forms API listening on port ${PORT}`);
});
