require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  limit: 25,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." }
}));

let firebaseStatus = "not_configured";
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    firebaseStatus = "connected";
  } catch (err) {
    firebaseStatus = "configuration_error";
    console.error("Firebase initialization failed:", err.message);
  }
}

function providerConfig(provider) {
  if (provider === "longcat") {
    return {
      key: process.env.LONGCAT_API_KEY,
      baseUrl: process.env.LONGCAT_BASE_URL,
      model: process.env.LONGCAT_MODEL,
      label: "LongCat"
    };
  }
  return {
    key: process.env.OPENAI_API_KEY,
    baseUrl: "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    label: "OpenAI"
  };
}

function systemPrompt(mode, projectType) {
  const shared = `You are LongCat, a careful senior software engineer and coding agent.
Give practical, complete, testable answers. Do not claim you created, ran, deployed, or tested files unless you actually did.
When writing code, provide complete files where practical, name each file clearly, include setup steps, and mention assumptions.
Never ask the user to paste API keys into frontend code, HTML, JavaScript, GitHub commits, or chat. Secrets belong in backend environment variables.
Do not invent provider API endpoints, model names, Firebase settings, or deployment results.
User's selected project type: ${projectType || "general software"}.`;
  if (mode === "agent") {
    return shared + `

You are operating in Agent Planning mode. Break substantial work into clear phases:
1. inspect requirements and identify missing facts,
2. propose architecture and file tree,
3. implement complete files,
4. provide test commands and expected results,
5. explain deployment.
You do not have direct access to a shell, filesystem, GitHub, or deployment tools in this app. Therefore never pretend to execute commands or modify a real repository. Generate file contents and precise actions the user can perform. For risky operations, explain safeguards first.`;
  }
  return shared + `

You are operating in Coding Assistant mode. Help with code generation, explanation, review, refactoring, debugging, and precise edits. When editing, return the full revised file unless a small patch is clearly better.`;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "LongCat AI Studio",
    version: "1.0.0",
    providers: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      longcat: Boolean(process.env.LONGCAT_API_KEY && process.env.LONGCAT_BASE_URL && process.env.LONGCAT_MODEL)
    },
    firebase: firebaseStatus
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, provider = "openai", mode = "assistant", projectType = "general software", history = [] } = req.body || {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Please enter a message." });
    }
    if (message.length > 30000) {
      return res.status(413).json({ error: "Message is too long. Please shorten it." });
    }
    if (!["openai", "longcat"].includes(provider)) {
      return res.status(400).json({ error: "Unsupported provider." });
    }
    const cfg = providerConfig(provider);
    if (!cfg.key) {
      return res.status(503).json({ error: `${cfg.label} API key is not configured in Render Environment.` });
    }
    if (!cfg.baseUrl || !cfg.model) {
      return res.status(503).json({ error: "LongCat base URL or model is missing. Add the exact values from the provider's API documentation in Render Environment." });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-12).filter(x =>
      x && ["user", "assistant"].includes(x.role) && typeof x.content === "string"
    ).map(x => ({ role: x.role, content: x.content.slice(0, 12000) })) : [];

    const endpoint = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cfg.key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: systemPrompt(mode, projectType) },
          ...safeHistory,
          { role: "user", content: message.trim() }
        ],
        temperature: 0.4
      })
    });

    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { error: { message: raw.slice(0, 1000) } }; }

    if (!upstream.ok) {
      const detail = data?.error?.message || `Provider returned HTTP ${upstream.status}`;
      return res.status(502).json({ error: `${cfg.label} API error: ${detail}` });
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "The AI provider returned an empty or unsupported response format." });
    }
    res.json({ reply, provider, model: cfg.model });
  } catch (err) {
    console.error("Chat request failed:", err.message);
    res.status(500).json({ error: "Server error while contacting the AI provider. Check Render logs for details." });
  }
});

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`LongCat AI Studio listening on ${PORT}`));
