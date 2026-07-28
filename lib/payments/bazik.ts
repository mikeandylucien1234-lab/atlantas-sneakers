import { Bazik } from "bazik-sdk";
import { bazikConfig } from "./bazik-config";

let client: Bazik | null = null;

// Singleton Bazik client built from env OR bazik.config.json (server-side).
export function getBazik(): Bazik {
  const cfg = bazikConfig();
  if (!cfg.userID || !cfg.secretKey) {
    throw new Error("Bazik n'est pas configuré (variables BAZIK_* ou fichier bazik.config.json manquants).");
  }
  if (!client) {
    client = new Bazik({ userID: cfg.userID, secretKey: cfg.secretKey });
  }
  return client;
}
