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

const { sendRegisterVerifyMock } = vi.hoisted(() => ({
  sendRegisterVerifyMock: vi.fn(),
}));

vi.mock("../../../src/lib/email/events", () => ({
  sendRegisterVerify: sendRegisterVerifyMock,
}));

const TEST_SECRET = "test-secret-32-characters-long!!";

import {
  resendVerifyEmailAction,
  verifyEmailAction,
} from "../../../src/server/users/actions";

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

    const result = await verifyEmailAction({ ok: false, error: "initial" }, formData);

    expect(result.ok).toBe(true);
    expect(result.data?.verified).toBe(true);
    expect(result.error).toBeUndefined();

    const updated = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(updated.emailVerified).not.toBeNull();
    expect(updated.emailVerified).toBeInstanceOf(Date);
  });

  it("eksik token error döner", async () => {
    const formData = new FormData();
    formData.append("token", "");

    const result = await verifyEmailAction({ ok: false, error: "initial" }, formData);

    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Geçersiz doğrulama bağlantısı.");
  });

  it("geçersiz imza error döner", async () => {
    const formData = new FormData();
    formData.append("token", "invalid.token.signature");

    const result = await verifyEmailAction({ ok: false, error: "initial" }, formData);

    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
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

    const result = await verifyEmailAction({ ok: false, error: "initial" }, formData);

    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
  });

  it("olmayan kullanıcı error döner", async () => {
    const token = createVerifyToken("yok@karavan.test");
    const formData = new FormData();
    formData.append("token", token);

    const result = await verifyEmailAction({ ok: false, error: "initial" }, formData);

    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Kullanıcı bulunamadı.");
  });

  it("zaten doğrulanmış kullanıcı idempotent success döner", async () => {
    const email = "already-verified@karavan.test";
    const verifiedAt = new Date("2026-01-01T00:00:00.000Z");
    await prisma.user.create({ data: makeUser({ email, emailVerified: verifiedAt }) });

    const token = createVerifyToken(email);
    const formData = new FormData();
    formData.append("token", token);

    const result = await verifyEmailAction({ ok: false, error: "initial" }, formData);

    expect(result.ok).toBe(true);
    expect(result.data?.verified).toBe(true);
    expect(result.error).toBeUndefined();

    // emailVerified değişmemeli
    const updated = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(updated.emailVerified).toEqual(verifiedAt);
  });
});

describe("resendVerifyEmailAction", () => {
  beforeEach(async () => {
    await resetDb();
    sendRegisterVerifyMock.mockClear();
  });

  function resendForm(email: string): FormData {
    const formData = new FormData();
    formData.append("email", email);
    return formData;
  }

  it("bilinmeyen ve doğrulanmış adresler BİREBİR aynı yanıtı döner (oracle yok)", async () => {
    const verifiedEmail = "verified@karavan.test";
    await prisma.user.create({
      data: makeUser({
        email: verifiedEmail,
        emailVerified: new Date("2026-01-01T00:00:00.000Z"),
      }),
    });

    const unknown = await resendVerifyEmailAction(
      { ok: false, error: "initial" },
      resendForm("yok@karavan.test"),
    );
    const verified = await resendVerifyEmailAction(
      { ok: false, error: "initial" },
      resendForm(verifiedEmail),
    );

    expect(unknown).toEqual(verified);
    expect(unknown.ok).toBe(true);
    // İkisinde de e-posta gönderilmez (doğrulanmışa yeniden gönderim yok).
    expect(sendRegisterVerifyMock).not.toHaveBeenCalled();
  });

  it("doğrulanmamış kullanıcıya e-posta gönderir ve ok döner", async () => {
    const email = "unverified@karavan.test";
    await prisma.user.create({ data: makeUser({ email, emailVerified: null }) });

    const result = await resendVerifyEmailAction(
      { ok: false, error: "initial" },
      resendForm(email),
    );

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ verified: false });
    expect(sendRegisterVerifyMock).toHaveBeenCalledTimes(1);
    expect(sendRegisterVerifyMock.mock.calls[0][0]).toBe(email);
  });

  it("e-posta boşsa fail döner", async () => {
    const formData = new FormData();
    formData.append("email", "");

    const result = await resendVerifyEmailAction(
      { ok: false, error: "initial" },
      formData,
    );

    expect(result.ok).toBe(false);
  });

  it("art arda istekler hız sınırına takılır", async () => {
    const email = "throttled@karavan.test";
    await prisma.user.create({ data: makeUser({ email, emailVerified: null }) });
    const prevState = { ok: false, error: "initial" } as const;

    let last = await resendVerifyEmailAction(prevState, resendForm(email));
    // VERIFY_RESEND_LIMIT aşılana kadar ok, sonra fail.
    for (let i = 0; i < 10 && last.ok; i += 1) {
      last = await resendVerifyEmailAction(prevState, resendForm(email));
    }

    expect(last.ok).toBe(false);
    if (!last.ok) {
      expect(last.error).toBe("Çok fazla istek gönderdiniz, biraz bekleyin");
    }
  });
});
