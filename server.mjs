import "dotenv/config";
import express from "express";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { createServer, request as httpRequest } from "http";
import { WebSocketServer, WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || (isProd ? "0.0.0.0" : "127.0.0.1");
const BACKEND_HOST = process.env.BACKEND_HOST || "127.0.0.1";
const BACKEND_PORT = Number(process.env.BACKEND_PORT) || 8000;
const distDir = path.join(__dirname, "frontend", "dist");

function backendRequestOptions(reqPath, req, method = req.method) {
  return {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: reqPath,
    method,
    headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` },
  };
}

// ── Reverse proxy: /api/v1/* → FastAPI (before body parsers) ──
app.use("/api/v1", (req, res) => {
  const proxyReq = httpRequest(backendRequestOptions(`/api/v1${req.url}`, req), (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    if (!isProd) console.error("[proxy] /api/v1 error:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Backend unavailable" });
    }
  });

  req.pipe(proxyReq, { end: true });
});

app.get("/health", (_req, res) => {
  const proxyReq = httpRequest(
    { hostname: BACKEND_HOST, port: BACKEND_PORT, path: "/health", method: "GET" },
    (proxyRes) => {
    let body = "";
    proxyRes.on("data", (c) => {
      body += c;
    });
    proxyRes.on("end", () => {
      res.status(proxyRes.statusCode || 502).type("json").send(body || "{}");
    });
  });
  proxyReq.on("error", () => res.status(502).json({ ok: false, error: "Backend unavailable" }));
  proxyReq.end();
});

app.use(express.json({ limit: "1mb" }));

function geminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function mapVoiceSelection(voiceKey) {
  const k = (voiceKey || "").toLowerCase();
  if (k === "male" || k === "male_indian") {
    return process.env.ELEVENLABS_VOICE_MALE_ID || "pNInz6obpgDQGcFmaJgB";
  }
  if (k === "female" || k === "female_indian") {
    return process.env.ELEVENLABS_VOICE_FEMALE_ID || "21m00Tcm4TlvDq8ikWAM";
  }
  if (k === "random") {
    return Math.random() < 0.5
      ? (process.env.ELEVENLABS_VOICE_MALE_ID || "pNInz6obpgDQGcFmaJgB")
      : (process.env.ELEVENLABS_VOICE_FEMALE_ID || "21m00Tcm4TlvDq8ikWAM");
  }
  return process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
}

app.post("/api/gemini", async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "GEMINI_API_KEY is not set. Add it to .env" });
  }

  const { system, prompt, history } = req.body || {};
  const contents = [];

  if (Array.isArray(history)) {
    for (const h of history) {
      const role = h.role === "user" ? "user" : "model";
      const text = typeof h.text === "string" ? h.text : "";
      if (!text) continue;
      contents.push({ role, parts: [{ text }] });
    }
  }

  if (typeof prompt === "string" && prompt.trim()) {
    contents.push({ role: "user", parts: [{ text: prompt.trim() }] });
  }

  if (!contents.length) {
    return res.status(400).json({ error: "Provide prompt and/or history" });
  }

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.75,
    },
  };

  if (typeof system === "string" && system.trim()) {
    body.systemInstruction = { parts: [{ text: system.trim() }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${encodeURIComponent(key)}`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return res.status(r.status).json({ error: msg });
    }
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join("") || "";
    if (!text) {
      return res.status(502).json({ error: "Empty model response" });
    }
    return res.json({ text: text.trim() });
  } catch (e) {
    return res.status(502).json({ error: e?.message || "Gemini request failed" });
  }
});

app.post("/api/elevenlabs/tts", async (req, res) => {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "ELEVENLABS_API_KEY is not set. Add it to .env" });
  }

  const { text, voiceId, voiceKey } = req.body || {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  const vid = voiceId || mapVoiceSelection(voiceKey);
  const trimmed = text.length > 2500 ? text.slice(0, 2500) : text;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        model_id: "eleven_multilingual_v2",
        text: trimmed,
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).send(errText);
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buf);
  } catch (e) {
    res.status(502).send(e?.message || "TTS failed");
  }
});

if (isProd) {
  if (!existsSync(path.join(distDir, "index.html"))) {
    console.error("Production build missing. Run: npm run build");
    process.exit(1);
  }
  app.use(express.static(distDir, { index: false, maxAge: isProd ? "7d" : 0 }));
  app.get(/^(?!\/api\/)(?!\/ws\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

function geminiLiveModel() {
  return process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
}

const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/ws/gemini-live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else if (url.pathname.startsWith("/api/v1/interview/ws")) {
    const proxyReq = httpRequest(
      backendRequestOptions(url.pathname + url.search, request, "GET"),
      () => {},
    );
    proxyReq.on("upgrade", (proxyRes, proxySocket) => {
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\n` +
          Object.entries(proxyRes.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\r\n") +
          "\r\n\r\n",
      );
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });
    proxyReq.on("error", () => socket.destroy());
    proxyReq.end();
  } else {
    socket.destroy();
  }
});

wss.on("connection", (clientWs) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    clientWs.send(JSON.stringify({ error: "GEMINI_API_KEY is not set. Add it to .env" }));
    clientWs.close();
    return;
  }

  const model = geminiLiveModel();
  const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`;

  let geminiWs;
  try {
    geminiWs = new WebSocket(geminiUrl);
  } catch (e) {
    clientWs.send(JSON.stringify({ error: "Failed to connect to Gemini Live" }));
    clientWs.close();
    return;
  }

  let setupSent = false;

  geminiWs.on("open", () => {
    if (!isProd) console.log(`[gemini-live] upstream open (model: ${model})`);
  });

  geminiWs.on("message", (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(typeof data === "string" ? data : data.toString());
    }
  });

  geminiWs.on("close", () => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  geminiWs.on("error", (e) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: e.message }));
      clientWs.close();
    }
  });

  clientWs.on("message", (data) => {
    const str = typeof data === "string" ? data : data.toString();
    if (!setupSent) {
      try {
        const msg = JSON.parse(str);
        if (msg.setup) {
          msg.setup.model = `models/${model}`;
          setupSent = true;
          if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(JSON.stringify(msg));
          } else {
            geminiWs.once("open", () => geminiWs.send(JSON.stringify(msg)));
          }
          return;
        }
      } catch (_) {
        /* ignore */
      }
    }
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(str);
    }
  });

  clientWs.on("close", () => {
    if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
  });
});

httpServer.listen(PORT, HOST, () => {
  const mode = isProd ? "production" : "development";
  console.log(`Tayyar gateway (${mode}) http://${HOST}:${PORT}/`);
  if (isProd) {
    console.log(`Serving frontend from ${distDir}`);
  } else {
    console.log("React dev UI: npm run dev:vite → http://127.0.0.1:5174/");
  }
  console.log(`API proxy → http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1`);
});
