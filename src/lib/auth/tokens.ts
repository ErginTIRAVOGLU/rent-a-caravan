import { createHmac } from "crypto";
import { normalizeEmail } from "../../server/users/service";

/**
 * Doğrulama linki üretir: `email` + 24 saat sonrası `exp` → HMAC imzalı token.
 * Kullanım: `const link = \`${baseUrl}/dogrula?token=${createVerifyToken(email)}\``
 */
export function createVerifyToken(email: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET tanımlı değil");
  }
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 saat
  const payload = { email: normalizeEmail(email), exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}