import express from "express";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  getDialogueFilterPayload,
  getDialogueTransformPayload,
  getPracticeGradePayload,
  getReviewPayload,
  getScenePayload,
  getSyncPayload,
  getYoulearnChatPayload,
  saveSyncPayload,
  getYoulearnSpacePayload
} from "./learning.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env"));

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));

app.post("/api/scene", async (req, res) => {
  const result = await getScenePayload(req.body);
  res.status(result.status).json(result.body);
});

app.post("/api/review", async (req, res) => {
  const result = await getReviewPayload(req.body);
  res.status(result.status).json(result.body);
});

app.get("/api/youlearn-space", async (req, res) => {
  const result = await getYoulearnSpacePayload(req.query);
  res.status(result.status).json(result.body);
});

app.post("/api/dialogue-transform", async (req, res) => {
  const result = await getDialogueTransformPayload(req.body);
  res.status(result.status).json(result.body);
});

app.post("/api/dialogue-filter", async (req, res) => {
  const result = await getDialogueFilterPayload(req.body);
  res.status(result.status).json(result.body);
});

app.post("/api/youlearn-chat", async (req, res) => {
  const result = await getYoulearnChatPayload(req.body);
  res.status(result.status).json(result.body);
});

app.post("/api/practice-grade", async (req, res) => {
  const result = await getPracticeGradePayload(req.body);
  res.status(result.status).json(result.body);
});

app.get("/api/sync", async (req, res) => {
  const result = await getSyncPayload(req.query);
  res.status(result.status).json(result.body);
});

app.post("/api/sync", async (req, res) => {
  const result = await saveSyncPayload(req.body);
  res.status(result.status).json(result.body);
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(rootDir, "dist")));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(rootDir, "dist", "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
}

app.listen(port, "127.0.0.1", () => {
  console.log(`DialogDungeon running at http://127.0.0.1:${port}`);
});

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
