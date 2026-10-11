import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma";
import {
  getReviewsEnabledCore,
  updateSettingCore,
} from "../../../src/server/admin/service";
import type { SessionUser } from "../../../src/server/users/service";
import { makeUser, resetDb } from "../../helpers/db";

// Ayarlar — yorum sistemi anahtarı "reviewsEnabled". getter: satır yoksa
// varsayılan true (yorumlar AÇIK). Yazma: updateSettingCore upsert; yalnız
// admin. Display guard'ların (reviewsEnabled) uygulama tarafı testleri
// tests/server/reviews/service.test.ts içindedir; burada ayarın KENDİ
// okuma/yazma/yetki yüzeyi doğrulanır.

/** DB kullanıcısını service'in beklediği ADMIN oturum kimliğine çevirir. */
function adminSession(user: {
  id: string;
  name: string;
  email: string;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "ADMIN",
    isBanned: false,
  };
}

/** DB kullanıcısını service'in beklediği USER oturum kimliğine çevirir. */
function memberSession(user: {
  id: string;
  name: string;
  email: string;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "USER",
    isBanned: false,
  };
}

describe("getReviewsEnabledCore", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("ayar satırı yoksa varsayılan true döner (yorumlar açık)", async () => {
    expect(await prisma.setting.count()).toBe(0);

    expect(await getReviewsEnabledCore()).toBe(true);
  });

  it("satırda false yazıyorsa false döner", async () => {
    await prisma.setting.create({ data: { key: "reviewsEnabled", value: false } });

    expect(await getReviewsEnabledCore()).toBe(false);
  });

  it("satırda true yazıyorsa true döner", async () => {
    await prisma.setting.create({ data: { key: "reviewsEnabled", value: true } });

    expect(await getReviewsEnabledCore()).toBe(true);
  });
});

describe("updateSettingCore — reviewsEnabled round-trip", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("admin false yazar → satır oluşur ve getReviewsEnabledCore false döner", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ role: "ADMIN" }),
    });

    const result = await updateSettingCore(
      adminSession(admin),
      "reviewsEnabled",
      false,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ key: "reviewsEnabled", value: false });
    }
    const saved = await prisma.setting.findUniqueOrThrow({
      where: { key: "reviewsEnabled" },
    });
    expect(saved.value).toBe(false);
    expect(saved.updatedAt).toBeInstanceOf(Date);
    // Yazım hemen okunur: kapatma anlık uygulanır
    expect(await getReviewsEnabledCore()).toBe(false);
  });

  it("ikinci yazım aynı satırı günceller (upsert) → true, tek satır kalır", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ role: "ADMIN" }),
    });

    await updateSettingCore(adminSession(admin), "reviewsEnabled", false);
    const result = await updateSettingCore(
      adminSession(admin),
      "reviewsEnabled",
      true,
    );

    expect(result.ok).toBe(true);
    expect(await prisma.setting.count({ where: { key: "reviewsEnabled" } })).toBe(1);
    expect(
      (await prisma.setting.findUniqueOrThrow({ where: { key: "reviewsEnabled" } })).value,
    ).toBe(true);
    expect(await getReviewsEnabledCore()).toBe(true);
  });

  it("diğer ayar anahtarları reviewsEnabled değerini etkilemez", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ role: "ADMIN" }),
    });

    await updateSettingCore(adminSession(admin), "someOtherKey", true);

    expect(await getReviewsEnabledCore()).toBe(true);
  });
});

describe("updateSettingCore — yetki ve doğrulama", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("role=USER → fail, hiçbir ayar satırı yazılmaz, varsayılan true kalır", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ role: "ADMIN" }),
    });
    const member = await prisma.user.create({ data: makeUser() });

    const result = await updateSettingCore(
      memberSession(member),
      "reviewsEnabled",
      false,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("yetkiniz yok");
    }
    expect(await prisma.setting.count()).toBe(0);
    expect(await getReviewsEnabledCore()).toBe(true);
    // Yönetici satırı da var; getter başka anahtarlara bakmaz
    expect(admin.id).toBeTruthy();
  });

  it("boş anahtar → fail (alan key), satır yazılmaz", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ role: "ADMIN" }),
    });

    const result = await updateSettingCore(adminSession(admin), "", false);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Geçersiz ayar anahtarı");
      expect(result.field).toBe("key");
    }
    expect(await prisma.setting.count()).toBe(0);
  });
});
