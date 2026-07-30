import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "VLearn AI Tutor Server" });
});

// Serve the canonical PDF directly from the repository. The slide viewer no
// longer depends on the FastAPI proxy just to display a document.
app.get("/api/documents/:docId/file", (req, res) => {
  const { docId } = req.params;
  if (!/^[A-Za-z0-9_-]+$/.test(docId)) {
    return res.status(400).json({ detail: "doc_id không hợp lệ" });
  }

  const pdfPath = path.resolve(
    process.cwd(),
    "..",
    "server",
    "data",
    "slides",
    `${docId}.pdf`,
  );
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ detail: `Không tìm thấy PDF '${docId}'.` });
  }

  res.sendFile(pdfPath);
});

// Proxy every remaining API request to FastAPI. Express parses JSON here and
// explicitly re-serializes it, avoiding the consumed-body bug from Vite proxy.
app.use("/api", express.json({ limit: "10mb" }), async (req, res) => {
  try {
    const targetUrl = `${BACKEND_URL}${req.originalUrl}`;
    const headers: Record<string, string> = {};
    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
    });
    const responseBody = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    res.status(response.status).send(responseBody);
  } catch (error) {
    console.error("FastAPI proxy error:", error);
    res.status(502).json({
      detail: "Không kết nối được FastAPI backend tại cổng 8000.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VLearn AI Tutor Server running on http://localhost:${PORT}`);
  });
}

startServer();
