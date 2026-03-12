const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = [
  "https://www.synvittadiagnostics.com",
  "https://synvittadiagnostics.com",
  "https://app.synvittadiagnostics.com",
  "http://localhost:5173",
  "http://localhost:1010",
];

app.use(helmet());
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

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@synvittadiagnostics.com",
      to: contactEmail,
      replyTo: (email || "").trim(),
      subject: `[Synvitta Contact] ${(interest || "").trim()} – ${(name || "").trim()}`,
      text,
      html,
    });

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

app.listen(PORT, () => {
  console.log(`Synvitta Forms API listening on port ${PORT}`);
});
