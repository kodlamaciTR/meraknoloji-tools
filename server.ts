import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API route for VirusTotal check
  app.get("/api/check-hash/:hash", async (req, res) => {
    try {
      const { hash } = req.params;
      const vtApiKey = process.env.VIRUSTOTAL_API_KEY;

      if (!vtApiKey) {
        console.warn("VIRUSTOTAL_API_KEY is not defined. Skipping live check, returning safe by default.");
        return res.json({ isSafe: true, message: "No API key configured." });
      }

      const response = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
        headers: {
          'x-apikey': vtApiKey
        }
      });

      if (response.status === 404) {
        // Hash not found in VT database, assume safe for now as we don't upload
        return res.json({ isSafe: true, maliciousCount: 0 });
      }

      if (!response.ok) {
        console.error(`VirusTotal API error: ${response.status} ${response.statusText}`);
        // Default to safe on API errors to avoid blocking users entirely, or we could block?
        // Let's assume safe if API is down.
        return res.json({ isSafe: true, message: "VirusTotal API Error" });
      }

      const data = await response.json();
      const maliciousCount = data.data?.attributes?.last_analysis_stats?.malicious || 0;

      if (maliciousCount > 0) {
        return res.json({ isSafe: false, maliciousCount });
      }

      res.json({ isSafe: true, maliciousCount });
    } catch (error) {
      console.error("Error in check-hash proxy:", error);
      res.json({ isSafe: true, message: "Internal server error during VirusTotal check." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // NOTE: app.get('*', ...) is used in express 4
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
