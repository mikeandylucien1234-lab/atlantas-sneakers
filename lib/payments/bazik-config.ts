import "server-only";
import fs from "fs";
import path from "path";

export type BazikConfig = { userID?: string; secretKey?: string; webhookSecret?: string };

let cached: BazikConfig | null = null;

// Resolve Bazik credentials from env FIRST, then from a JSON file at the project
// root (bazik.config.json / .bazik.json) for hosts where env vars are awkward.
// The file is git-ignored and never bundled.
export function bazikConfig(): BazikConfig {
  if (cached) return cached;

  const cfg: BazikConfig = {
    userID: process.env.BAZIK_USER_ID,
    secretKey: process.env.BAZIK_SECRET_KEY,
    webhookSecret: process.env.BAZIK_WEBHOOK_SECRET,
  };

  if (!cfg.userID || !cfg.secretKey) {
    const candidates = [
      path.join(process.cwd(), "bazik.config.json"),
      path.join(process.cwd(), "bazikconfig.json"),
      path.join(process.cwd(), ".bazik.json"),
    ];
    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) {
          const j = JSON.parse(fs.readFileSync(file, "utf8"));
          cfg.userID = cfg.userID || j.userID || j.BAZIK_USER_ID;
          cfg.secretKey = cfg.secretKey || j.secretKey || j.BAZIK_SECRET_KEY;
          cfg.webhookSecret = cfg.webhookSecret || j.webhookSecret || j.BAZIK_WEBHOOK_SECRET;
          break;
        }
      } catch { /* ignore malformed file */ }
    }
  }

  cached = cfg;
  return cfg;
}
