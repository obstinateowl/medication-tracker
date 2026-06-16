import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "./config.js";
import { checkDatabase, logDbHealth } from "./dbHealth.js";
import { formatDbError, isDbError } from "./dbErrors.js";
import profilesRouter from "./routes/profiles.js";
import profileMedicationsRouter from "./routes/profileMedications.js";
import medicationsRouter from "./routes/medications.js";
import dosesRouter from "./routes/doses.js";
import householdRouter from "./routes/household.js";
import { startMqttPoller, stopMqttPoller } from "./mqtt/poller.js";

const app = express();

/** Home Assistant Ingress proxy address */
const INGRESS_PROXY = "172.30.32.2";

if (config.isHaAddon) {
  app.set("trust proxy", true);
  app.use((req, res, next) => {
    const remote =
      req.socket.remoteAddress?.replace("::ffff:", "") ??
      req.ip?.replace("::ffff:", "") ??
      "";
    const allowed =
      remote === INGRESS_PROXY ||
      remote === "127.0.0.1" ||
      remote === "::1";
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

app.use(
  cors({
    origin: config.clientOrigins,
  })
);
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const db = await checkDatabase();
  // Always 200 so the client can distinguish API-up/DB-down from API-unreachable
  res.status(200).json({
    ok: db.ok,
    api: true,
    database: db,
  });
});

app.use("/api/profiles", profilesRouter);
app.use("/api/profiles", profileMedicationsRouter);
app.use("/api/medications", medicationsRouter);
app.use("/api/doses", dosesRouter);
app.use("/api/household", householdRouter);

if (config.staticDir) {
  const indexPath = join(config.staticDir, "index.html");

  function serveIndexHtml(req: express.Request, res: express.Response) {
    let html = readFileSync(indexPath, "utf8");
    const ingressPath = req.get("x-ingress-path") ?? "/";
    const normalized = ingressPath.endsWith("/")
      ? ingressPath
      : `${ingressPath}/`;
    html = html.replace(
      "<head>",
      `<head><script>window.__INGRESS_PATH__=${JSON.stringify(normalized)}</script>`
    );
    res.type("html").send(html);
  }

  // Never serve raw index.html from static — ingress path must be injected first
  app.get("/", serveIndexHtml);
  app.get("/index.html", serveIndexHtml);
  app.use(express.static(config.staticDir, { index: false }));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    try {
      serveIndexHtml(req, res);
    } catch {
      next();
    }
  });
}

app.use(
  (
    err: Error & { code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[api]", err);

    if (isDbError(err)) {
      const info = formatDbError(err);
      res.status(503).json({
        error: info.message,
        code: info.code,
        hint: info.hint,
        details: info.details,
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
);

async function start() {
  const db = await checkDatabase();
  logDbHealth(db);

  if (!db.ok) {
    console.warn(
      "[db] Server will start anyway — fix database settings and retry."
    );
  }

  const server = app.listen(config.port, config.host);

  server.on("listening", () => {
    console.log(`Medication Tracker listening on ${config.host}:${config.port}`);
    if (config.isHaAddon) {
      console.log("Home Assistant Ingress enabled (port 8099)");
    } else {
      console.log(`Health check: http://localhost:${config.port}/api/health`);
    }
    void startMqttPoller();
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[startup] Port ${config.port} is already in use.`);
    } else if (err.code === "EADDRNOTAVAIL") {
      console.error(
        `[startup] Cannot bind to ${config.host}:${config.port}.`
      );
    } else {
      console.error("[startup] Server failed to start:", err.message);
    }
    process.exit(1);
  });
}

start().catch((err) => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void stopMqttPoller().finally(() => process.exit(0));
  });
}
