import "server-only";
import fs from "fs";
import path from "path";

export type OwnerConfig = {
  email?: string;
  password?: string;
  sessionSecret?: string;
  stripeWebhookSecret?: string;
};

let cached: OwnerConfig | null = null;

// Resolve owner credentials from env FIRST, then fall back to a JSON file at the
// project root (owner-vault.config.json) for hosts where setting env vars is
// impractical. The file is git-ignored and never bundled.
export function ownerConfig(): OwnerConfig {
  if (cached) return cached;

  const cfg: OwnerConfig = {
    email: process.env.OWNER_EMAIL,
    password: process.env.OWNER_PASSWORD,
    sessionSecret: process.env.OWNER_SESSION_SECRET,
    stripeWebhookSecret: process.env.OWNER_STRIPE_WEBHOOK_SECRET,
  };

  if (!cfg.email || !cfg.password) {
    const candidates = [
      path.join(process.cwd(), "owner-vault.config.json"),
      path.join(process.cwd(), "ownervault.config.json"),
      path.join(process.cwd(), ".owner-vault.json"),
      path.join(process.cwd(), ".ownervault.json"),
    ];
    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) {
          const j = JSON.parse(fs.readFileSync(file, "utf8"));
          cfg.email = cfg.email || j.email || j.OWNER_EMAIL;
          cfg.password = cfg.password || j.password || j.OWNER_PASSWORD;
          cfg.sessionSecret = cfg.sessionSecret || j.sessionSecret || j.OWNER_SESSION_SECRET;
          cfg.stripeWebhookSecret = cfg.stripeWebhookSecret || j.stripeWebhookSecret || j.OWNER_STRIPE_WEBHOOK_SECRET;
          break;
        }
      } catch { /* ignore malformed file */ }
    }
  }

  cached = cfg;
  return cfg;
}
