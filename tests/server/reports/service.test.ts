import { beforeEach, describe, expect, it } from "vitest";
import type { ReportStatus, ReportTargetType } from "@prisma/client";

import { prisma } from "../../../src/lib/prisma";
import { NEXT_REPORT_STATUS } from "../../../src/lib/validators/report";
import {
  createReportCore,
  getReportsCore,
  updateReportStatusCore,
} from "../../../src/server/reports/service";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// Şikayet çekirdeği — HTTP/oturum yok: `user`/`admin` açık parametre; aksiyonlar
// requireUser/requireAdmin ile sarar.
//
// Odak (spec §8 + §10.1): hedef doğrulama (LISTING/USER), mükerrer AÇIK şikayet
// engeli, gerekçe 5–500 karakter, durum matrisi OPEN→REVIEWING→CLOSED
// (CLOSED terminal, matris dışı geçiş fail + mutation yok) ve ADMIN yetkisi.

function mockUser(id: string, email: string, role: "USER" | "ADMIN" = "USER") {
  return { id, name: "Test", email, role, isBanned: false };
}

const GEREKCE = "İlan açıklaması gerçek fotoğraflardan uzak.";

beforeEach(async () => {
  await resetDb();
});

describe("createReportCore", () => {
  let reporter: Awaited<ReturnType<typeof makeUser>>;
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    reporter = await prisma.user.create({
      data: makeUser({ email: "reporter@test.com" }),
    });
    owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
  });

  it("LISTING hedefi var → OPEN şikayet oluşturulur, gerekçe kırpılarak kaydedilir", async () => {
    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      `  ${GEREKCE}  `,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("OPEN");
      expect(result.data.targetType).toBe("LISTING");
      expect(result.data.targetId).toBe(listing.id);
      expect(result.data.reporterId).toBe(reporter.id);
      expect(result.data.reason).toBe(GEREKCE);
      expect(result.data.updatedAt).toBeNull();
    }
  });

  it("USER hedefi var → OPEN şikayet oluşturulur", async () => {
    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "USER",
      owner.id,
      GEREKCE,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targetType).toBe("USER");
      expect(result.data.targetId).toBe(owner.id);
    }
  });

  it("hedef ilan silinmiş → fail (İlan bulunamadı), kayıt yazılmaz", async () => {
    await prisma.listing.delete({ where: { id: listing.id } });

    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      GEREKCE,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("İlan bulunamadı");
    }
    expect(await prisma.report.count()).toBe(0);
  });

  it("hedef kullanıcı silinmiş → fail (Kullanıcı bulunamadı), kayıt yazılmaz", async () => {
    await prisma.user.delete({ where: { id: owner.id } });

    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "USER",
      owner.id,
      GEREKCE,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Kullanıcı bulunamadı");
    }
    expect(await prisma.report.count()).toBe(0);
  });

  it("gerekçe 4 karakter → fail + field=reason", async () => {
    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      "kısa",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("reason");
      expect(result.error).toContain("5");
    }
    expect(await prisma.report.count()).toBe(0);
  });

  it("gerekçe 501 karakter → fail + field=reason", async () => {
    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      "x".repeat(501),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("reason");
    }
    expect(await prisma.report.count()).toBe(0);
  });

  it("gerekçe yalnız boşluktan oluşuyorsa → fail", async () => {
    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      "     ",
    );

    expect(result.ok).toBe(false);
    expect(await prisma.report.count()).toBe(0);
  });

  it("gerekçe tam 5 ve tam 500 karakter → kabul edilir", async () => {
    const min = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      "a".repeat(5),
    );
    expect(min.ok).toBe(true);

    const max = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "USER",
      owner.id,
      "b".repeat(500),
    );
    expect(max.ok).toBe(true);
  });

  it("aynı kullanıcı aynı hedefe AÇIK şikayet varken tekrar bildiremez", async () => {
    const first = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      GEREKCE,
    );
    expect(first.ok).toBe(true);

    const second = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      "İkinci kez bildiriyorum.",
    );

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("zaten");
    }
    expect(await prisma.report.count()).toBe(1);
  });

  it("şikayet kapatıldıktan sonra aynı kullanıcı yeniden bildirebilir", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ email: "admin@test.com", role: "ADMIN" }),
    });
    const first = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      GEREKCE,
    );
    expect(first.ok).toBe(true);
    const reportId = first.ok ? first.data.id : "";

    // OPEN → REVIEWING → CLOSED (matris sırasıyla)
    const reviewing = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "REVIEWING",
    );
    expect(reviewing.ok).toBe(true);
    const closed = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "CLOSED",
    );
    expect(closed.ok).toBe(true);

    const again = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      "Yeniden bildiriyorum, sorun devam ediyor.",
    );
    expect(again.ok).toBe(true);
    expect(await prisma.report.count()).toBe(2);
  });

  it("başka kullanıcı aynı hedefi bildirebilir", async () => {
    await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      GEREKCE,
    );
    const other = await prisma.user.create({
      data: makeUser({ email: "other@test.com" }),
    });

    const result = await createReportCore(
      mockUser(other.id, other.email),
      "LISTING",
      listing.id,
      "Ben de aynı sorunu yaşadım.",
    );

    expect(result.ok).toBe(true);
    expect(await prisma.report.count()).toBe(2);
  });

  it("geçersiz ilan kimliği biçimi → fail", async () => {
    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      "ilan-id",
      GEREKCE,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("ilan kimliği");
    }
  });

  it("geçersiz kullanıcı kimliği biçimi → fail", async () => {
    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "USER",
      "kullanici-id",
      GEREKCE,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("kullanıcı kimliği");
    }
  });

  it("bilinmeyen hedef tipi → fail, mutation yok", async () => {
    const result = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "POST" as unknown as ReportTargetType,
      listing.id,
      GEREKCE,
    );

    expect(result.ok).toBe(false);
    expect(await prisma.report.count()).toBe(0);
  });
});

describe("updateReportStatusCore", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let member: Awaited<ReturnType<typeof makeUser>>;
  let reporter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let reportId: string;

  beforeEach(async () => {
    admin = await prisma.user.create({
      data: makeUser({ email: "admin@test.com", role: "ADMIN" }),
    });
    member = await prisma.user.create({
      data: makeUser({ email: "member@test.com" }),
    });
    reporter = await prisma.user.create({
      data: makeUser({ email: "reporter@test.com" }),
    });
    listing = await prisma.listing.create({
      data: makeListing(admin.id, { status: "ACTIVE" }),
    });
    const created = await createReportCore(
      mockUser(reporter.id, reporter.email),
      "LISTING",
      listing.id,
      GEREKCE,
    );
    reportId = created.ok ? created.data.id : "";
  });

  it("OPEN → REVIEWING (ADMIN) → geçer, updatedAt yazılır", async () => {
    const result = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "REVIEWING",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("REVIEWING");
      expect(result.data.updatedAt).not.toBeNull();
    }
  });

  it("REVIEWING → CLOSED (ADMIN) → geçer", async () => {
    const reviewing = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "REVIEWING",
    );
    expect(reviewing.ok).toBe(true);

    const closed = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "CLOSED",
    );

    expect(closed.ok).toBe(true);
    if (closed.ok) {
      expect(closed.data.status).toBe("CLOSED");
    }
  });

  it("CLOSED terminal: CLOSED → REVIEWING fail, durum CLOSED kalır", async () => {
    await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "REVIEWING",
    );
    await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "CLOSED",
    );

    const reopen = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "REVIEWING",
    );

    expect(reopen.ok).toBe(false);
    expect(
      (await prisma.report.findUniqueOrThrow({ where: { id: reportId } })).status,
    ).toBe("CLOSED");
  });

  it("matris dışı: OPEN → CLOSED fail, durum OPEN kalır", async () => {
    const result = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "CLOSED",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("durumda değil");
    }
    expect(
      (await prisma.report.findUniqueOrThrow({ where: { id: reportId } })).status,
    ).toBe("OPEN");
  });

  it("matris dışı: aynı duruma geçiş fail, updatedAt değişmez", async () => {
    const before = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
    });

    const same = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "OPEN",
    );

    expect(same.ok).toBe(false);
    const after = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
    });
    expect(after.status).toBe("OPEN");
    expect(after.updatedAt?.getTime() ?? 0).toBe(
      before.updatedAt?.getTime() ?? 0,
    );
  });

  it("role=USER → fail (YETKI_YOK), durum değişmez", async () => {
    const result = await updateReportStatusCore(
      mockUser(member.id, member.email),
      reportId,
      "REVIEWING",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("yetkiniz yok");
    }
    expect(
      (await prisma.report.findUniqueOrThrow({ where: { id: reportId } })).status,
    ).toBe("OPEN");
  });

  it("şikayet bulunamadı → fail", async () => {
    const result = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      `c${"0".repeat(24)}`,
      "REVIEWING",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Şikayet bulunamadı");
    }
  });

  it("geçersiz şikayet kimliği → fail", async () => {
    const result = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      "sikayet-id",
      "REVIEWING",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("şikayet kimliği");
    }
  });

  it("bilinmeyen durum değeri → fail, mutation yok", async () => {
    const result = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      reportId,
      "DELETED" as ReportStatus,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Geçersiz şikayet durumu");
      expect(result.field).toBe("status");
    }
    expect(
      (await prisma.report.findUniqueOrThrow({ where: { id: reportId } })).status,
    ).toBe("OPEN");
  });
});

/**
 * `NEXT_REPORT_STATUS` — admin kuyruğu satır düğmelerinin kaynağı. Bu test,
 * istemcinin teklif ettiği her geçişin sunucu matrisince gerçekten GEÇERLİ
 * olduğunu (ve terminal durumda hiçbir düğme olmadığını) doğrular: iki taraf
 * sessizce diverge ederse bu test kırılır.
 */
describe("NEXT_REPORT_STATUS — istemci düğme matrisi", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let reporter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    admin = await prisma.user.create({
      data: makeUser({ email: "admin@test.com", role: "ADMIN" }),
    });
    reporter = await prisma.user.create({
      data: makeUser({ email: "reporter@test.com" }),
    });
    listing = await prisma.listing.create({
      data: makeListing(admin.id, { status: "ACTIVE" }),
    });
  });

  async function seedReport(status: ReportStatus) {
    return prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: GEREKCE,
        status,
      },
    });
  }

  it("her durum için teklif edilen geçiş service matrisince geçerlidir", async () => {
    for (const current of ["OPEN", "REVIEWING", "CLOSED"] as ReportStatus[]) {
      const next = NEXT_REPORT_STATUS[current];
      const report = await seedReport(current);

      if (next === null) {
        // Terminal durum: hiçbir geçiş kabul edilmez (düğme gösterilmez).
        expect(
          (await updateReportStatusCore(
            mockUser(admin.id, admin.email, "ADMIN"),
            report.id,
            "OPEN",
          )).ok,
        ).toBe(false);
        expect(
          (await updateReportStatusCore(
            mockUser(admin.id, admin.email, "ADMIN"),
            report.id,
            "REVIEWING",
          )).ok,
        ).toBe(false);
        continue;
      }

      const result = await updateReportStatusCore(
        mockUser(admin.id, admin.email, "ADMIN"),
        report.id,
        next,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe(next);
      }
    }
  });
});

describe("kimlik doğrulama — tip kontrolü", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let owner: Awaited<ReturnType<typeof makeUser>>;

  beforeEach(async () => {
    admin = await prisma.user.create({
      data: makeUser({ email: "admin@test.com", role: "ADMIN" }),
    });
    owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
  });

  /**
   * `CUID_RE.test(value)` değeri METNE çevirir: regex'i geçen bir `toString`'e
   * sahip nesne kontrolü aşabilir ve Prisma 500'e düşerdi. Kapı bu yüzden
   * TİP kontrolüdür (regex ikinci adım) — aşağıdaki nesne ikisi arasındaki
   * farkı gösterir.
   */
  const craftedId = { toString: () => `c${"a".repeat(24)}` } as unknown as string;

  it("hedef kimliği string olmayan bir değerse → temiz fail, kayıt yazılmaz", async () => {
    const result = await createReportCore(
      mockUser(owner.id, owner.email),
      "LISTING",
      craftedId,
      GEREKCE,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("ilan kimliği");
      expect(result.field).toBe("targetId");
    }
    expect(await prisma.report.count()).toBe(0);
  });

  it("şikayet kimliği string olmayan bir değerse → temiz fail", async () => {
    const result = await updateReportStatusCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      craftedId,
      "REVIEWING",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("şikayet kimliği");
      expect(result.field).toBe("reportId");
    }
    expect(await prisma.report.count()).toBe(0);
  });
});

describe("getReportsCore", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, {
        title: "Antalya Karavan",
        status: "ACTIVE",
      }),
    });
  });

  it("şikayet yoksa boş kuyruk döner", async () => {
    const result = await getReportsCore();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it("LISTING hedefi → hedef etiketi başlık, link /ilan/[id]", async () => {
    const reporter = await prisma.user.create({
      data: makeUser({ email: "reporter@test.com" }),
    });
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: GEREKCE,
      },
    });

    const result = await getReportsCore();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      const row = result.data[0];
      expect(row.target.type).toBe("LISTING");
      expect(row.target.label).toBe("Antalya Karavan");
      expect(row.target.href).toBe(`/ilan/${listing.id}`);
      expect(row.reporter.id).toBe(reporter.id);
      expect(row.reporter.email).toBe("reporter@test.com");
      expect(row.status).toBe("OPEN");
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.reason).toBe(GEREKCE);
      // passwordHash gibi alanlar kuyruk yanıtına sızmaz
      expect(Object.keys(row.reporter).sort()).toEqual([
        "email",
        "id",
        "name",
      ]);
    }
  });

  it("USER hedefi → hedef etiketi kullanıcı adı, link yönetim kullanıcı listesi", async () => {
    const reporter = await prisma.user.create({
      data: makeUser({ email: "reporter@test.com" }),
    });
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "USER",
        targetId: owner.id,
        reason: GEREKCE,
      },
    });

    const result = await getReportsCore();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const row = result.data[0];
      expect(row.target.type).toBe("USER");
      expect(row.target.label).toBe(owner.name);
      expect(row.target.href).toBe("/admin/kullanicilar");
    }
  });

  it("hedef silinmişse kırık link yok: etiket 'Silinmiş …', href null", async () => {
    const reporter = await prisma.user.create({
      data: makeUser({ email: "reporter@test.com" }),
    });
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: GEREKCE,
      },
    });
    await prisma.listing.delete({ where: { id: listing.id } });

    const result = await getReportsCore();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].target.href).toBeNull();
      expect(result.data[0].target.label).toContain("Silinmiş");
    }
  });

  it("kuyruk en yeniden eskiye sıralanır", async () => {
    const reporter = await prisma.user.create({
      data: makeUser({ email: "reporter@test.com" }),
    });
    const older = await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: "Eski şikayet gerekçesi.",
      },
    });
    const newer = await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "USER",
        targetId: owner.id,
        reason: "Yeni şikayet gerekçesi.",
      },
    });
    await prisma.report.update({
      where: { id: older.id },
      data: { createdAt: new Date("2026-01-01T00:00:00Z") },
    });
    await prisma.report.update({
      where: { id: newer.id },
      data: { createdAt: new Date("2026-02-01T00:00:00Z") },
    });

    const result = await getReportsCore();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((row) => row.id)).toEqual([newer.id, older.id]);
    }
  });
});
