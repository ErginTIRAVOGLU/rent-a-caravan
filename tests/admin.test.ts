import { beforeEach, expect, it, vi } from "vitest";

// E-posta olayları mock'lanır: akış asla gerçek SMTP'ye gitmez; ayrıca
// "e-posta düşürse bile karar kalır" testi için fırlatma enjekte edilir.
vi.mock("../src/lib/email/events", () => ({
  sendListingStatusChanged: vi.fn(),
}));

import { sendListingStatusChanged } from "../src/lib/email/events";
import { prisma } from "../src/lib/prisma";
import {
  approveListingCore,
  pauseListingCore,
  rejectListingCore,
  setUserBannedCore,
  unpauseListingCore,
} from "../src/server/admin/service";
import { submitListingCore } from "../src/server/listings/service";
import {
  verifyCredentials,
  type SessionUser,
} from "../src/server/users/service";
import { makeListing, makeUser, resetDb } from "./helpers/db";

// Admin moderasyonu — Review Focus: yetki matrisi (ADMIN-only), SUNUCU otoriter
// durum geçiş matrisi (yalnız PENDING→ACTIVE|REJECTED, ACTIVE→PAUSED), gerekçe
// zorunluluğu, ban korumaları (self-ban / son yönetici), e-posta hatası akışı
// düşürmez.

beforeEach(() => {
  vi.clearAllMocks();
});

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

/** Onaylamak için sık okunan ilan satırı. */
async function getListing(id: string) {
  return prisma.listing.findUniqueOrThrow({ where: { id } });
}

// ---------------------------------------------------------------------------
// Yetki matrisi — ADMIN-only
// ---------------------------------------------------------------------------

it("yetki: role=USER dört işlemi de fail alır, hiçbir kayıt değişmez", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const member = await prisma.user.create({ data: makeUser() });
  const target = await prisma.user.create({ data: makeUser() });
  const pending = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING" }),
  });
  const active = await prisma.listing.create({
    data: makeListing(owner.id, { status: "ACTIVE" }),
  });
  const actor = memberSession(member);

  const approve = await approveListingCore(actor, pending.id);
  const reject = await rejectListingCore(actor, pending.id, "Gerekçe");
  const pause = await pauseListingCore(actor, active.id);
  const ban = await setUserBannedCore(actor, target.id, true);

  for (const result of [approve, reject, pause, ban]) {
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("yetkiniz yok");
    }
  }
  // Mutation yok: durumlar ve ban bayrağı olduğu gibi kalır
  expect((await getListing(pending.id)).status).toBe("PENDING");
  expect((await getListing(active.id)).status).toBe("ACTIVE");
  expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).isBanned).toBe(false);
  expect(sendListingStatusChanged).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// approveListingCore — PENDING → ACTIVE
// ---------------------------------------------------------------------------

it("approve: PENDING → ACTIVE, rejectionReason temizlenir, ilan sahibine email gider", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "PENDING",
      rejectionReason: "Eski gerekçe", // temizlenmeli
    }),
  });

  const result = await approveListingCore(adminSession(admin), listing.id);

  expect(result.ok).toBe(true);
  const saved = await getListing(listing.id);
  expect(saved.status).toBe("ACTIVE");
  expect(saved.rejectionReason).toBeNull();

  expect(sendListingStatusChanged).toHaveBeenCalledTimes(1);
  const [to, data] = vi.mocked(sendListingStatusChanged).mock.calls[0];
  expect(to).toBe(owner.email); // bildirim ilan SAHİBİNE gider
  expect(data.status).toBe("ACTIVE");
  expect(data.listingTitle).toBe(listing.title);
});

it("approve: REDDEDİLEN ilan yeniden gönderimle (T6 submit) ACTIVE'e ulaşır", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "REJECTED",
      rejectionReason: "Fotoğraflar yetersiz",
      photoUrls: ["https://cdn.karavan.test/ilan/1.jpg"],
    }),
  });

  // Sahip düzeltip yeniden gönderir: REJECTED → PENDING (T6 submitListingCore)
  const resubmit = await submitListingCore(memberSession(owner), listing.id);
  expect(resubmit.ok).toBe(true);
  expect((await getListing(listing.id)).status).toBe("PENDING");

  // Admin sonucu onaylar: PENDING → ACTIVE
  const approve = await approveListingCore(adminSession(admin), listing.id);
  expect(approve.ok).toBe(true);
  const saved = await getListing(listing.id);
  expect(saved.status).toBe("ACTIVE");
  expect(saved.rejectionReason).toBeNull();
  // Bildirim yalnızca onaydan (submit e-posta tetiklemez)
  expect(sendListingStatusChanged).toHaveBeenCalledTimes(1);
});

it("approve: matriste olmayan geçişler fail, mutation yok, email yok", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const draft = await prisma.listing.create({
    data: makeListing(owner.id, { status: "DRAFT" }),
  });
  const active = await prisma.listing.create({
    data: makeListing(owner.id, { status: "ACTIVE" }),
  });
  const paused = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PAUSED" }),
  });
  const rejected = await prisma.listing.create({
    data: makeListing(owner.id, { status: "REJECTED" }),
  });

  // DRAFT → ACTIVE yok; ACTIVE → ACTIVE yok; PAUSED → ACTIVE yok (sahip
  // submit ile PAUSED → PENDING olur, yeniden yayına ALIM admin onayındadır);
  // REJECTED → ACTIVE yok (düzeltme + yeniden gönderim zorunlu).
  for (const listing of [draft, active, paused, rejected]) {
    const result = await approveListingCore(adminSession(admin), listing.id);
    expect(result.ok).toBe(false);
  }
  expect((await getListing(draft.id)).status).toBe("DRAFT");
  expect((await getListing(active.id)).status).toBe("ACTIVE");
  expect((await getListing(paused.id)).status).toBe("PAUSED");
  expect((await getListing(rejected.id)).status).toBe("REJECTED");
  expect(sendListingStatusChanged).not.toHaveBeenCalled();
});

it("approve: geçersiz/ilgisiz ilan kimliği fail döner", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });

  const badId = await approveListingCore(adminSession(admin), "abc");
  expect(badId.ok).toBe(false);
  if (!badId.ok) {
    expect(badId.error).toContain("Geçersiz ilan kimliği");
  }

  // CUID biçiminde ama DB'de kay olmayan kimlik (c + 24 alfanümerik)
  const missingId = `c${"0".repeat(24)}`;
  const missing = await approveListingCore(adminSession(admin), missingId);
  expect(missing.ok).toBe(false);
  if (!missing.ok) {
    expect(missing.error).toContain("bulunamadı");
  }
});

it("approve: email client hata fırlatsa da ilan ACTIVE kalır", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING" }),
  });
  vi.mocked(sendListingStatusChanged).mockImplementationOnce(() => {
    throw new Error("SMTP kapalı");
  });

  const result = await approveListingCore(adminSession(admin), listing.id);

  expect(result.ok).toBe(true); // e-posta HATASI kararı düşürmez
  expect((await getListing(listing.id)).status).toBe("ACTIVE");
});

// ---------------------------------------------------------------------------
// rejectListingCore — PENDING → REJECTED + gerekçe
// ---------------------------------------------------------------------------

it("reject: PENDING → REJECTED, gerekçe yazılır + email", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING" }),
  });

  const result = await rejectListingCore(
    adminSession(admin),
    listing.id,
    "Fotoğraflar yetersiz",
  );

  expect(result.ok).toBe(true);
  const saved = await getListing(listing.id);
  expect(saved.status).toBe("REJECTED");
  expect(saved.rejectionReason).toBe("Fotoğraflar yetersiz");

  expect(sendListingStatusChanged).toHaveBeenCalledTimes(1);
  const [to, data] = vi.mocked(sendListingStatusChanged).mock.calls[0];
  expect(to).toBe(owner.email);
  expect(data.status).toBe("REJECTED");
  expect(data.reason).toBe("Fotoğraflar yetersiz");
});

it("reject: boş gerekçe fail döner, durum PENDING kalır, email gitmez", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING" }),
  });

  const result = await rejectListingCore(adminSession(admin), listing.id, "   ");

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("gerekçe");
    expect(result.field).toBe("reason");
  }
  expect((await getListing(listing.id)).status).toBe("PENDING");
  expect(sendListingStatusChanged).not.toHaveBeenCalled();
});

it("reject: 1000 karakteri aşan gerekçe fail döner, durum değişmez", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING" }),
  });

  const result = await rejectListingCore(
    adminSession(admin),
    listing.id,
    "x".repeat(1001),
  );

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.field).toBe("reason");
  }
  expect((await getListing(listing.id)).status).toBe("PENDING");
  expect(sendListingStatusChanged).not.toHaveBeenCalled();
});

it("reject: PENDING olmayan ilan reddedilemez (ACTIVE→REJECTED yok), mutation yok", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const active = await prisma.listing.create({
    data: makeListing(owner.id, { status: "ACTIVE" }),
  });
  const paused = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PAUSED" }),
  });

  const activeReject = await rejectListingCore(
    adminSession(admin),
    active.id,
    "Gerekçe",
  );
  expect(activeReject.ok).toBe(false);
  expect((await getListing(active.id)).status).toBe("ACTIVE");

  const pausedReject = await rejectListingCore(
    adminSession(admin),
    paused.id,
    "Gerekçe",
  );
  expect(pausedReject.ok).toBe(false);
  expect((await getListing(paused.id)).status).toBe("PAUSED");
  expect(sendListingStatusChanged).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// pauseListingCore — ACTIVE → PAUSED
// ---------------------------------------------------------------------------

it("pause: ACTIVE → PAUSED + email; PENDING/DRAFT ilan duraklatılamaz", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const active = await prisma.listing.create({
    data: makeListing(owner.id, { status: "ACTIVE" }),
  });
  const pending = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING" }),
  });
  const draft = await prisma.listing.create({
    data: makeListing(owner.id, { status: "DRAFT" }),
  });

  const result = await pauseListingCore(adminSession(admin), active.id);
  expect(result.ok).toBe(true);
  expect((await getListing(active.id)).status).toBe("PAUSED");
  expect(sendListingStatusChanged).toHaveBeenCalledTimes(1);
  const [to, data] = vi.mocked(sendListingStatusChanged).mock.calls[0];
  expect(to).toBe(owner.email);
  expect(data.status).toBe("PAUSED");

  const pendingPause = await pauseListingCore(adminSession(admin), pending.id);
  expect(pendingPause.ok).toBe(false);
  expect((await getListing(pending.id)).status).toBe("PENDING");

  const draftPause = await pauseListingCore(adminSession(admin), draft.id);
  expect(draftPause.ok).toBe(false);
  expect((await getListing(draft.id)).status).toBe("DRAFT");

  // Yalnızca ilk başarılı pause e-posta gönderdi
  expect(sendListingStatusChanged).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// unpauseListingCore — PAUSED → ACTIVE (admin "Yayına Al")
// ---------------------------------------------------------------------------

it("unpause: ACTIVE → PAUSED → ACTIVE turu, iki karar da sahibine e-postalanır", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "ACTIVE" }),
  });

  const paused = await pauseListingCore(adminSession(admin), listing.id);
  expect(paused.ok).toBe(true);
  expect((await getListing(listing.id)).status).toBe("PAUSED");

  const unpaused = await unpauseListingCore(adminSession(admin), listing.id);
  expect(unpaused.ok).toBe(true);
  expect((await getListing(listing.id)).status).toBe("ACTIVE");

  expect(sendListingStatusChanged).toHaveBeenCalledTimes(2);
  const [, second] = vi.mocked(sendListingStatusChanged).mock.calls[1];
  expect(second.status).toBe("ACTIVE");
});

it("unpause: role=USER fail, PAUSED durum değişmez, email yok", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const member = await prisma.user.create({ data: makeUser() });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PAUSED" }),
  });
  expect(admin.id).toBeTruthy();

  const result = await unpauseListingCore(memberSession(member), listing.id);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("yetkiniz yok");
  }
  expect((await getListing(listing.id)).status).toBe("PAUSED");
  expect(sendListingStatusChanged).not.toHaveBeenCalled();
});

it("unpause: matris dışı durumlar fail (PENDING/ACTIVE/DRAFT/REJECTED), mutation yok", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const pending = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING" }),
  });
  const active = await prisma.listing.create({
    data: makeListing(owner.id, { status: "ACTIVE" }),
  });
  const draft = await prisma.listing.create({
    data: makeListing(owner.id, { status: "DRAFT" }),
  });
  const rejected = await prisma.listing.create({
    data: makeListing(owner.id, { status: "REJECTED" }),
  });

  for (const listing of [pending, active, draft, rejected]) {
    const result = await unpauseListingCore(adminSession(admin), listing.id);
    expect(result.ok).toBe(false);
  }
  expect((await getListing(pending.id)).status).toBe("PENDING");
  expect((await getListing(active.id)).status).toBe("ACTIVE");
  expect((await getListing(draft.id)).status).toBe("DRAFT");
  expect((await getListing(rejected.id)).status).toBe("REJECTED");
  expect(sendListingStatusChanged).not.toHaveBeenCalled();
});

it("unpause: geçersiz/kayıtsız kimlik fail döner", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });

  const badId = await unpauseListingCore(adminSession(admin), "abc");
  expect(badId.ok).toBe(false);
  if (!badId.ok) {
    expect(badId.error).toContain("Geçersiz ilan kimliği");
  }

  const missingId = `c${"0".repeat(24)}`;
  const missing = await unpauseListingCore(adminSession(admin), missingId);
  expect(missing.ok).toBe(false);
  if (!missing.ok) {
    expect(missing.error).toContain("bulunamadı");
  }
});

// ---------------------------------------------------------------------------
// setUserBannedCore — ban aç / kapa + korumalar
// ---------------------------------------------------------------------------

it("ban: isBanned=true → verifyCredentials null döner; ban açınca tekrar giriş mümkün", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const member = await prisma.user.create({ data: makeUser({ emailVerified: new Date() }) });

  // Ban öncesi giriş açık (demo şifresi: demo1234)
  expect(await verifyCredentials(member.email, "demo1234")).not.toBeNull();

  const ban = await setUserBannedCore(adminSession(admin), member.id, true);
  expect(ban.ok).toBe(true);
  // Geniş inceleme düzeltmesi: yanıt azaltılmış DTO — passwordHash/googleId
  // action yanıtına asla sızmaz (bcrypt hash'i offline kaba kuvvet malzemesi).
  if (ban.ok) {
    expect(ban.data.isBanned).toBe(true);
    expect(ban.data).not.toHaveProperty("passwordHash");
    expect(ban.data).not.toHaveProperty("googleId");
    expect(Object.keys(ban.data).sort()).toEqual([
      "email",
      "id",
      "isBanned",
      "name",
      "role",
    ]);
  }
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).isBanned,
  ).toBe(true);
  // Giriş kapandı: şifre doğru olsa bile doğrulama null
  expect(await verifyCredentials(member.email, "demo1234")).toBeNull();

  const unban = await setUserBannedCore(adminSession(admin), member.id, false);
  expect(unban.ok).toBe(true);
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).isBanned,
  ).toBe(false);
  expect(await verifyCredentials(member.email, "demo1234")).not.toBeNull();
});

it("ban: yönetici kendi hesabını banlayamaz — fail, isBanned=false kalır", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });

  const result = await setUserBannedCore(adminSession(admin), admin.id, true);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("Kendi hesabınızı");
  }
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).isBanned,
  ).toBe(false);
});

it("ban: sistemdeki son aktif yönetici banlanamaz — fail, hedef değişmez", async () => {
  await resetDb();
  // Kural testi: banlı bir yönetici oturumu (yöneticinin rolü kalmış olsa da
  // aktif yönetici Sayımı hedefi sayar) son AKTİF yöneticiyi hedefler.
  const staleAdmin = await prisma.user.create({
    data: makeUser({ role: "ADMIN", isBanned: true }),
  });
  const lastActiveAdmin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const regular = await prisma.user.create({ data: makeUser() });

  const result = await setUserBannedCore(
    adminSession(staleAdmin),
    lastActiveAdmin.id,
    true,
  );

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("son aktif yönetici");
  }
  expect(
    (
      await prisma.user.findUniqueOrThrow({ where: { id: lastActiveAdmin.id } })
    ).isBanned,
  ).toBe(false);

  // Aynı koruma NORMAL kullanıcıya uygulanmaz
  const memberBan = await setUserBannedCore(
    adminSession(staleAdmin),
    regular.id,
    true,
  );
  expect(memberBan.ok).toBe(true);
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: regular.id } })).isBanned,
  ).toBe(true);
});

it("ban: geçersiz kimlik / var olmayan kullanıcı fail, hedef değişmez", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const member = await prisma.user.create({ data: makeUser() });

  const badId = await setUserBannedCore(adminSession(admin), "not-a-cuid", true);
  expect(badId.ok).toBe(false);
  if (!badId.ok) {
    expect(badId.error).toContain("Geçersiz kullanıcı kimliği");
  }

  // CUID biçiminde ama DB'de kay olmayan kimlik (c + 24 alfanümerik)
  const missingId = `c${"0".repeat(24)}`;
  const missing = await setUserBannedCore(adminSession(admin), missingId, true);
  expect(missing.ok).toBe(false);
  if (!missing.ok) {
    expect(missing.error).toContain("bulunamadı");
  }

  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).isBanned,
  ).toBe(false);
});
