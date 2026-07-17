const { createServer } = require("http");
const { parse } = require("url");
const fs = require("fs");
const path = require("path");
const next = require("next");

// Minimal .env loader (no dependency). Loads KEY=VALUE lines from a .env file
// at the app root so server-side secrets (e.g. STRIPE_SECRET_KEY) are available
// even when the host does not inject the panel's environment variables into a
// custom startup file. Panel-injected vars always win (we only set if unset).
(function loadDotEnv() {
  for (const file of [".env", ".env.local", ".env.production"]) {
    try {
      const p = path.join(process.cwd(), file);
      if (!fs.existsSync(p)) continue;
      for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        if (key && process.env[key] === undefined) process.env[key] = val;
      }
    } catch (e) { /* ignore */ }
  }
})();

const dev = false;
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, hostname, () => {
    console.log(`Atlanta Sneakers ready on port ${port}`);
  });
});
