import { Bazik } from "bazik-sdk";

let client: Bazik | null = null;

// Singleton Bazik client built from server-side env credentials.
export function getBazik(): Bazik {
  if (!process.env.BAZIK_USER_ID || !process.env.BAZIK_SECRET_KEY) {
    throw new Error("Bazik credentials are not configured (BAZIK_USER_ID / BAZIK_SECRET_KEY).");
  }
  if (!client) {
    client = new Bazik({
      userID: process.env.BAZIK_USER_ID,
      secretKey: process.env.BAZIK_SECRET_KEY,
    });
  }
  return client;
}
