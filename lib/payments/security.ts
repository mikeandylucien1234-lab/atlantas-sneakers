import crypto from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export function generateIdempotencyKey(
  orderId: string,
  gateway: string
): string {
  return crypto
    .createHash("sha256")
    .update(`${orderId}:${gateway}`)
    .digest("hex");
}

export function validatePaymentAmount(
  expected: number,
  received: number,
  tolerance = 0.01
): boolean {
  return Math.abs(expected - received) <= tolerance;
}

export function checkReplayAttack(
  timestamp: number,
  toleranceMs = 300_000
): boolean {
  return Math.abs(Date.now() - timestamp) <= toleranceMs;
}
