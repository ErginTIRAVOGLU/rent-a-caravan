import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../../src/lib/prisma";
import { createVerifyToken } from "../../../src/lib/auth/tokens";
import { makeUser, resetDb } from "../../helpers/db";

// Mock next-auth before it's imported by auth.ts
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const TEST_SECRET = "test-secret-32-characters-long!!";

import { verifyEmailAction } from "../../../src/server/users/actions";

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", TEST_SECRET);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("verifyEmailAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("geçerli token ile emailVerified=true ayarlar ve success döner", async () => {
    const email = "verify-test@karavan.test";
    await prisma.user.create({ data: makeUser({ email, emailVerified: null }) });

    const token = createVerifyToken(email);
    const formData = new FormData();
    formData.append("token", token);

    const result = await verifyEmailAction({ error: null, success: false, verified: false }, formData);

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.error).toBeNull();

    const updated = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(updated.emailVerified).not.toBeNull();
    expect(updated.emailVerified).toBeInstanceOf(Date);
  });

  it("eksik token error döner", async () => {
    const formData = new FormData();
    formData.append("token", "");

    const result = await verifyEmailAction({ error: null, success: false, verified: false }, formData);

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.error).toBe("Geçersiz doğrulama bağlantısı.");
  });

  it("geçersiz imza error döner", async () => {
    const formData = new FormData();
    formData.append("token", "invalid.token.signature");

    const result = await verifyEmailAction({ error: null, success: false, verified: false }, formData);

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.error).toBe("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
  });

  it("süresi dolmuş token error döner", async () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    const payload = { email: "expired@karavan.test", exp };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const { createHmac } = await import("crypto");
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payloadB64)
      .digest("base64url");
    const token = `${payloadB64}.${signature}`;

    const formData = new FormData();
    formData.append("token", token);

    const result = await verifyEmailAction({ error: null, success: false, verified: false }, formData);

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.error).toBe("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
  });

  it("olmayan kullanıcı error döner", async () => {
    const token = createVerifyToken("yok@karavan.test");
    const formData = new FormData();
    formData.append("token", token);

    const result = await verifyEmailAction({ error: null, success: false, verified: false }, formData);

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.error).toBe("Kullanıcı bulunamadı.");
  });

  it("zaten doğrulanmış kullanıcı idempotent success döner", async () => {
    const email = "already-verified@karavan.test";
    const verifiedAt = new Date("2026-01-01T00:00:00.000Z");
    await prisma.user.create({ data: makeUser({ email, emailVerified: verifiedAt }) });

    const token = createVerifyToken(email);
    const formData = new FormData();
    formData.append("token", token);

    const result = await verifyEmailAction({ error: null, success: false, verified: false }, formData);

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.error).toBeNull();

    // emailVerified değişmemeli
    const updated = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(updated.emailVerified).toEqual(verifiedAt);
  });
});