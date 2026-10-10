import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

import { prisma } from "../../../src/lib/prisma";
import { verifyEmail, verifyCredentials, registerUser, linkGoogleUser } from "../../../src/server/users/service";
import { createVerifyToken } from "../../../src/lib/auth/tokens";
import { makeUser, resetDb } from "../../helpers/db";

// sendRegisterVerify mock'lanır ki testler gerçek e-posta göndermez.
const { mockSendRegisterVerify } = vi.hoisted(() => ({
  mockSendRegisterVerify: vi.fn(),
}));

vi.mock("../../../src/lib/email/events", () => ({
  sendRegisterVerify: mockSendRegisterVerify,
}));

const TEST_SECRET = "test-secret-32-characters-long!!";

// AUTH_SECRET testler için ayarlanır.
beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", TEST_SECRET);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyEmail / createVerifyToken", () => {
  it("geçerli token oluşturur ve doğrular", async () => {
    const email = "test@karavan.test";
    const token = createVerifyToken(email);
    const result = await verifyEmail(token);

    expect(result).not.toBeNull();
    expect(result?.email).toBe(email);
  });

  it("normalize edilmiş e-posta döner (büyük harf/boşluk)", async () => {
    const token = createVerifyToken("  TEST@KARAVAN.TEST  ");
    const result = await verifyEmail(token);

    expect(result?.email).toBe("test@karavan.test");
  });

  it("24 saat geçmiş token null döner (expired)", async () => {
    // Token'ı manuel oluşturup exp'i geçmişe al.
    const exp = Math.floor(Date.now() / 1000) - 3600; // 1 saat önce
    const payload = { email: "expired@karavan.test", exp };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const { createHmac } = await import("crypto");
    const signature = createHmac("sha256", TEST_SECRET)
      .update(payloadB64)
      .digest("base64url");
    const token = `${payloadB64}.${signature}`;

    const result = await verifyEmail(token);
    expect(result).toBeNull();
  });

  it("bozuk imza null döner", async () => {
    const token = createVerifyToken("test@karavan.test");
    const [payload] = token.split(".");
    const badToken = `${payload}.bad-signature`;

    const result = await verifyEmail(badToken);
    expect(result).toBeNull();
  });

  it("eksik/kuru payload null döner", async () => {
    expect(await verifyEmail("")).toBeNull();
    expect(await verifyEmail("no-dot")).toBeNull();
    expect(await verifyEmail("payload.only")).toBeNull();
  });

  it("AUTH_SECRET yoksa verifyEmail throw eder", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_SECRET", "");
    
    const payload = { email: "test@karavan.test", exp: Math.floor(Date.now() / 1000) + 86400 };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", "dummy-secret")
      .update(payloadB64)
      .digest("base64url");
    const token = `${payloadB64}.${signature}`;
    
    await expect(verifyEmail(token)).rejects.toThrow("AUTH_SECRET tanımlı değil");
    vi.stubEnv("AUTH_SECRET", TEST_SECRET);
  });
});

describe("registerUser + sendRegisterVerify", () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it("kayıt başarılıysa sendRegisterVerify çağrılır", async () => {
    const result = await registerUser({
      name: "Test Kullanıcı",
      email: "yeni@karavan.test",
      password: "guclu-sifre-1",
    });

    expect(result.ok).toBe(true);
    expect(mockSendRegisterVerify).toHaveBeenCalledTimes(1);
    expect(mockSendRegisterVerify).toHaveBeenCalledWith("yeni@karavan.test", expect.any(String));
  });
});

describe("verifyCredentials: emailVerified kontrolü", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("emailVerified=null kullanıcı EmailNotVerifiedError fırlatır (giriş engeli)", async () => {
    const created = await prisma.user.create({
      data: makeUser({ emailVerified: null }),
    });

    await expect(verifyCredentials(created.email, "demo1234")).rejects.toThrow(
      "E-posta doğrulanmamış",
    );
  });

  it("emailVerified=dolu kullanıcı normal giriş yapar", async () => {
    const created = await prisma.user.create({
      data: makeUser({ emailVerified: new Date() }),
    });

    const user = await verifyCredentials(created.email, "demo1234");
    expect(user).not.toBeNull();
    expect(user?.id).toBe(created.id);
  });

  it("emailVerified alanı yoksa (eski veri) EmailNotVerifiedError fırlatır", async () => {
    // Prisma default null döndürür ama explicit test için.
    const created = await prisma.user.create({
      data: { ...makeUser(), emailVerified: null },
    });

    await expect(verifyCredentials(created.email, "demo1234")).rejects.toThrow(
      "E-posta doğrulanmamış",
    );
  });
});

describe("linkGoogleUser: emailVerified ayarlama", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("yeni Google kullanıcısı emailVerified=now ile oluşturulur", async () => {
    const result = await linkGoogleUser({
      googleId: "google-new-123",
      email: "google-yeni@karavan.test",
      name: "Google Yeni",
      avatarUrl: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const saved = await prisma.user.findUniqueOrThrow({
        where: { email: "google-yeni@karavan.test" },
      });
      expect(saved.emailVerified).not.toBeNull();
      expect(saved.emailVerified).toBeInstanceOf(Date);
    }
  });

  it("mevcut kullanıcı emailVerified=null ise girişte now ayarlanır", async () => {
    const created = await prisma.user.create({
      data: makeUser({ emailVerified: null }),
    });

    const result = await linkGoogleUser({
      googleId: "google-existing-456",
      email: created.email,
      name: created.name,
      avatarUrl: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(updated.emailVerified).not.toBeNull();
      expect(updated.emailVerified).toBeInstanceOf(Date);
    }
  });

  it("mevcut kullanıcı emailVerified=dolusa değiştirmez", async () => {
    const verifiedAt = new Date("2026-01-01T00:00:00.000Z");
    const created = await prisma.user.create({
      data: makeUser({ emailVerified: verifiedAt }),
    });

    const result = await linkGoogleUser({
      googleId: "google-existing-789",
      email: created.email,
      name: created.name,
      avatarUrl: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(updated.emailVerified).toEqual(verifiedAt);
    }
  });

  it("yarış durumunda emailVerified korur", async () => {
    const created = await prisma.user.create({
      data: makeUser({ googleId: "google-conflict", emailVerified: null }),
    });

    // Aynı googleId ile farklı e-posta → e-posta güncellenir, emailVerified now olur.
    const result = await linkGoogleUser({
      googleId: "google-conflict",
      email: "updated@karavan.test",
      name: "Updated",
      avatarUrl: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(updated.email).toBe("updated@karavan.test");
      expect(updated.emailVerified).not.toBeNull();
    }
  });
});
