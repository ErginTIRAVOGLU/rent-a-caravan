import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted auth mock — next-auth mock factory bu fonksiyonu döndürür.
const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
}));

// Mock next-auth
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: authMock,
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
  redirect: redirectMock,
}));

import { prisma } from "../../../src/lib/prisma";
import { getReviewsEnabledCore } from "../../../src/server/admin/service";
import { updateSetting } from "../../../src/server/admin/actions";
import { makeUser, resetDb } from "../../helpers/db";

// /admin/ayarlar yorum anahtarı — eylem katmanı: requireAdmin oturum kapısı
// (admin değilse yönlendirme + mutation yok), kapısı geçen yazım upsert eder
// ve getter yeni değeri okur. Çekirdek doğrulamaları service.test.ts'te.

function sessionWith(role: "USER" | "ADMIN", user: { id: string; name: string; email: string }) {
  authMock.mockResolvedValue({
    user: { ...user, role, isBanned: false },
  });
}

describe("updateSetting action — reviewsEnabled", () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it("admin oturumuyla false yazılır ve getter kapanmış okur", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ role: "ADMIN" }),
    });
    sessionWith("ADMIN", admin);

    const result = await updateSetting("reviewsEnabled", false);

    expect(result.ok).toBe(true);
    expect(
      (await prisma.setting.findUniqueOrThrow({ where: { key: "reviewsEnabled" } })).value,
    ).toBe(false);
    expect(await getReviewsEnabledCore()).toBe(false);
  });

  it("admin oturumuyla yeniden true yazılır (upsert günceller)", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ role: "ADMIN" }),
    });
    sessionWith("ADMIN", admin);

    await updateSetting("reviewsEnabled", false);
    const result = await updateSetting("reviewsEnabled", true);

    expect(result.ok).toBe(true);
    expect(await prisma.setting.count({ where: { key: "reviewsEnabled" } })).toBe(1);
    expect(await getReviewsEnabledCore()).toBe(true);
  });

  it("ADMIN olmayan oturum reddedilir — yetki hatası, ayar satırı yazılmaz", async () => {
    const member = await prisma.user.create({ data: makeUser() });
    sessionWith("USER", member);

    const result = await updateSetting("reviewsEnabled", false);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("yetkiniz yok");
    }
    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(await prisma.setting.count()).toBe(0);
    // Varsayılan değişmedi: yorumlar açık kalır
    expect(await getReviewsEnabledCore()).toBe(true);
  });

  it("oturum yoksa erken çıkar (requireAdmin → /giris), ayar satırı yazılmaz", async () => {
    authMock.mockResolvedValue(null);

    await expect(updateSetting("reviewsEnabled", false)).rejects.toThrow();

    expect(redirectMock).toHaveBeenCalledWith("/giris");
    expect(await prisma.setting.count()).toBe(0);
  });
});
