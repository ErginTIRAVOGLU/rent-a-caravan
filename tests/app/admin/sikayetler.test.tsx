// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// /admin/sikayetler — `durum` sekmeleri (Açık/İnceleniyor/Kapatıldı) + sunucu
// tarafı `?q=` araması (var olan alanlar: gerekçe, bildiren, hedef etiketi).
// Mevcut incele/kapat aksiyonları korunur.

const { authMock, redirectMock, getReportsCoreMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
  getReportsCoreMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: authMock,
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn() }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/sikayetler",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

// Kuyruk çekirdeği: varsayılan olarak GERÇEK implementasyon (testler DB'den
// okur); yalnız "kuyruk yüklenemez" senaryosunda mock üzerinden fail
// döndürülür — hata yolunu kırmak için DB'yi kırmak gerekmez.
vi.mock("../../../src/server/reports/service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../../src/server/reports/service")
  >();
  getReportsCoreMock.mockImplementation(actual.getReportsCore);
  return { ...actual, getReportsCore: getReportsCoreMock };
});

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

function setupAdmin() {
  authMock.mockResolvedValue({
    user: {
      id: "admin-1",
      name: "Yönetici",
      email: "admin@test.com",
      role: "ADMIN",
      isBanned: false,
    },
  });
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const { default: AdminReportsPage } = await import(
    "../../../src/app/admin/sikayetler/page"
  );
  return render(
    await AdminReportsPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

/** Bir bildiren + hedef ilan üzerinden şikayet oluşturur. */
async function makeReport(options: {
  reporterName: string;
  reason: string;
  status?: "OPEN" | "REVIEWING" | "CLOSED";
  targetTitle: string;
}) {
  const reporter = await prisma.user.create({
    data: makeUser({ name: options.reporterName }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { title: options.targetTitle }),
  });
  return prisma.report.create({
    data: {
      reporterId: reporter.id,
      targetType: "LISTING",
      targetId: listing.id,
      reason: options.reason,
      status: options.status ?? "OPEN",
    },
  });
}

describe("/admin/sikayetler", () => {
  it("metadata başlığı korunur", async () => {
    const { metadata } = await import(
      "../../../src/app/admin/sikayetler/page"
    );
    expect(metadata.title).toBe("Şikâyetler — Yönetim");
  });

  it("varsayılan sekme OPEN: yalnız açık şikayetleri gösterir ve sayaçları hesaplar", async () => {
    await makeReport({
      reporterName: "Bildiren Bir",
      reason: "Açık şikayet",
      status: "OPEN",
      targetTitle: "Hedef Bir",
    });
    await makeReport({
      reporterName: "Bildiren İki",
      reason: "İncelenen şikayet",
      status: "REVIEWING",
      targetTitle: "Hedef İki",
    });
    setupAdmin();

    await renderPage();

    const table = screen.getByTestId("admin-reports-table");
    expect(within(table).getByText("Açık şikayet")).toBeInTheDocument();
    expect(within(table).queryByText("İncelenen şikayet")).not.toBeInTheDocument();

    expect(screen.getByTestId("tab-count-OPEN")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-REVIEWING")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-CLOSED")).toHaveTextContent("0");
  });

  it("durum=CLOSED yalnız kapatılmış şikayetleri gösterir", async () => {
    await makeReport({
      reporterName: "Bildiren Bir",
      reason: "Açık şikayet",
      status: "OPEN",
      targetTitle: "Hedef Bir",
    });
    await makeReport({
      reporterName: "Bildiren İki",
      reason: "Kapanmış şikayet",
      status: "CLOSED",
      targetTitle: "Hedef İki",
    });
    setupAdmin();

    await renderPage({ durum: "CLOSED" });

    const table = screen.getByTestId("admin-reports-table");
    expect(within(table).getByText("Kapanmış şikayet")).toBeInTheDocument();
    expect(within(table).queryByText("Açık şikayet")).not.toBeInTheDocument();
    // CLOSED terminal: geçiş düğmesi yoktur.
    expect(within(table).queryByRole("button", { name: "İncele" })).toBeNull();
    expect(within(table).queryByRole("button", { name: "Kapat" })).toBeNull();
  });

  it("geçersiz durum OPEN davranışına düşer", async () => {
    await makeReport({
      reporterName: "Bildiren Bir",
      reason: "Açık şikayet",
      status: "OPEN",
      targetTitle: "Hedef Bir",
    });
    await makeReport({
      reporterName: "Bildiren İki",
      reason: "Kapanmış şikayet",
      status: "CLOSED",
      targetTitle: "Hedef İki",
    });
    setupAdmin();

    await renderPage({ durum: "gecersiz" });

    const table = screen.getByTestId("admin-reports-table");
    expect(within(table).getByText("Açık şikayet")).toBeInTheDocument();
    expect(within(table).queryByText("Kapanmış şikayet")).not.toBeInTheDocument();
  });

  it("q hedef başlığına büyük/küçük harf duyarsız uygular", async () => {
    await makeReport({
      reporterName: "Bildiren Bir",
      reason: "Birinci gerekçe",
      targetTitle: "Şüpheli İlan",
    });
    await makeReport({
      reporterName: "Bildiren İki",
      reason: "İkinci gerekçe",
      targetTitle: "Temiz İlan",
    });
    setupAdmin();

    await renderPage({ q: "şüpheli" });

    const table = screen.getByTestId("admin-reports-table");
    expect(within(table).getByText("Birinci gerekçe")).toBeInTheDocument();
    expect(within(table).queryByText("İkinci gerekçe")).not.toBeInTheDocument();
  });

  it("q Türkçe İ harfini katlar: 'ilan' araması 'İlan' hedefini bulur", async () => {
    await makeReport({
      reporterName: "Bildiren Bir",
      reason: "Birinci gerekçe",
      targetTitle: "İlan Başlığı",
    });
    await makeReport({
      reporterName: "Bildiren İki",
      reason: "İkinci gerekçe",
      targetTitle: "Temiz Başlık",
    });
    setupAdmin();

    await renderPage({ q: "ilan" });

    const table = screen.getByTestId("admin-reports-table");
    expect(within(table).getByText("Birinci gerekçe")).toBeInTheDocument();
    expect(within(table).queryByText("İkinci gerekçe")).not.toBeInTheDocument();
  });

  it("q bildiren adı/gerekçe üzerinde de eşleşir", async () => {
    await makeReport({
      reporterName: "Zeynep Bildiren",
      reason: "Birinci gerekçe",
      targetTitle: "Şüpheli İlan",
    });
    await makeReport({
      reporterName: "Murat Bildiren",
      reason: "İkinci gerekçe",
      targetTitle: "Temiz İlan",
    });
    setupAdmin();

    await renderPage({ q: "zeynep" });

    const table = screen.getByTestId("admin-reports-table");
    expect(within(table).getByText("Birinci gerekçe")).toBeInTheDocument();
    expect(within(table).queryByText("İkinci gerekçe")).not.toBeInTheDocument();
  });

  it("sayaçlar q'dan bağımsız tam dağılımı gösterir", async () => {
    await makeReport({
      reporterName: "A",
      reason: "r1",
      status: "OPEN",
      targetTitle: "Hedef A",
    });
    await makeReport({
      reporterName: "B",
      reason: "r2",
      status: "OPEN",
      targetTitle: "Hedef B",
    });
    await makeReport({
      reporterName: "C",
      reason: "r3",
      status: "REVIEWING",
      targetTitle: "Hedef C",
    });
    await makeReport({
      reporterName: "D",
      reason: "r4",
      status: "CLOSED",
      targetTitle: "Hedef D",
    });
    setupAdmin();

    await renderPage({ q: "r1" });

    expect(screen.getByTestId("tab-count-OPEN")).toHaveTextContent("2");
    expect(screen.getByTestId("tab-count-REVIEWING")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-CLOSED")).toHaveTextContent("1");
  });

  it("filtre boşsa tek EmptyState ve tek 'Aramayı temizle' linki gösterir", async () => {
    await makeReport({
      reporterName: "A",
      reason: "r1",
      targetTitle: "Hedef A",
    });
    setupAdmin();

    await renderPage({ q: "zzz-eslesmez" });

    expect(
      screen.getByText("Aramanızla eşleşen şikayet yok"),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Aramayı temizle" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/admin/sikayetler");
    expect(screen.queryByTestId("admin-reports-table")).not.toBeInTheDocument();
  });

  it("hiç şikayet yoksa tek CTA'lı boş durum gösterir", async () => {
    setupAdmin();

    await renderPage();

    expect(screen.getByText("Açık şikayet yok")).toBeInTheDocument();
    const cta = screen
      .getAllByRole("link")
      .filter((link) => link.textContent === "Genel Bakışa dön");
    expect(cta).toHaveLength(1);
    expect(cta[0]).toHaveAttribute("href", "/admin");
  });

  it("durum geçiş düğmelerini matrise göre sunar (OPEN→İncele, REVIEWING→Kapat, CLOSED→yok)", async () => {
    await makeReport({
      reporterName: "A",
      reason: "açık",
      status: "OPEN",
      targetTitle: "Hedef A",
    });
    await makeReport({
      reporterName: "B",
      reason: "inceleniyor",
      status: "REVIEWING",
      targetTitle: "Hedef B",
    });
    setupAdmin();

    // OPEN sekmesi: İncele düğmesi.
    const first = await renderPage({ durum: "OPEN" });
    const firstTable = screen.getByTestId("admin-reports-table");
    expect(
      within(firstTable).getByRole("button", { name: "İncele" }),
    ).toBeInTheDocument();
    expect(within(firstTable).queryByRole("button", { name: "Kapat" })).toBeNull();
    first.unmount();

    // REVIEWING sekmesi: Kapat düğmesi.
    await renderPage({ durum: "REVIEWING" });
    const secondTable = screen.getByTestId("admin-reports-table");
    expect(
      within(secondTable).getByRole("button", { name: "Kapat" }),
    ).toBeInTheDocument();
    expect(
      within(secondTable).queryByRole("button", { name: "İncele" }),
    ).toBeNull();
  });

  it("masaüstü tablo ve mobil kart aynı veriyi taşır", async () => {
    const reporter = await prisma.user.create({
      data: makeUser({ name: "Bildiren Kişi", email: "bildiren@test.com" }),
    });
    const owner = await prisma.user.create({ data: makeUser() });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Şüpheli İlan" }),
    });
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: "Uygunsuz içerik bildirimi.",
        status: "OPEN",
        createdAt: new Date("2026-03-05T00:00:00Z"),
      },
    });
    setupAdmin();

    await renderPage();

    for (const testid of ["admin-reports-table", "admin-reports-cards"]) {
      const scope = screen.getByTestId(testid);
      expect(
        within(scope).getByText("Uygunsuz içerik bildirimi."),
      ).toBeInTheDocument();
      expect(within(scope).getByText(/Bildiren Kişi/)).toBeInTheDocument();
      expect(within(scope).getByText(/bildiren@test\.com/)).toBeInTheDocument();
      expect(within(scope).getByText("Açık")).toBeInTheDocument();
      expect(within(scope).getByText("05.03.2026")).toBeInTheDocument();
      expect(within(scope).getByText("İlan")).toBeInTheDocument();
      expect(within(scope).getByRole("link", { name: "Şüpheli İlan" })).toHaveAttribute(
        "href",
        `/ilan/${listing.id}`,
      );
      expect(within(scope).getByRole("button", { name: "İncele" })).toBeInTheDocument();
    }
  });

  it("silinmiş hedefte kırık link gösterilmez", async () => {
    const reporter = await prisma.user.create({ data: makeUser() });
    const owner = await prisma.user.create({ data: makeUser() });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Silinecek İlan" }),
    });
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: "Kırık link testi.",
      },
    });
    await prisma.listing.delete({ where: { id: listing.id } });
    setupAdmin();

    await renderPage();

    for (const testid of ["admin-reports-table", "admin-reports-cards"]) {
      const scope = screen.getByTestId(testid);
      expect(within(scope).getByText(/Silinmiş ilan/)).toBeInTheDocument();
      expect(scope.querySelector("a[href*='/ilan/']")).toBeNull();
    }
  });

  it("USER hedefi yönetim kullanıcı listesine linklenir", async () => {
    const reporter = await prisma.user.create({ data: makeUser() });
    const target = await prisma.user.create({
      data: makeUser({ name: "Hedef Kullanıcı" }),
    });
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "USER",
        targetId: target.id,
        reason: "Hesap sahte görünüyor.",
      },
    });
    setupAdmin();

    await renderPage();

    for (const testid of ["admin-reports-table", "admin-reports-cards"]) {
      const scope = screen.getByTestId(testid);
      expect(within(scope).getByText("Kullanıcı")).toBeInTheDocument();
      expect(
        within(scope).getByRole("link", { name: "Hedef Kullanıcı" }),
      ).toHaveAttribute("href", "/admin/kullanicilar");
    }
  });

  it("kuyruk yüklenemezse 'Henüz şikayet yok' DEMEZ — hata sınırına düşer", async () => {
    getReportsCoreMock.mockResolvedValueOnce({
      ok: false,
      error: "Şikayet kuyruğu yüklenemedi.",
    });

    const { default: AdminReportsPage } = await import(
      "../../../src/app/admin/sikayetler/page"
    );

    await expect(
      AdminReportsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(/Şikayet kuyruğu yüklenemedi/);
  });

  it("admin oturumu kullanılır (requireAdmin)", async () => {
    await makeReport({
      reporterName: "A",
      reason: "r1",
      targetTitle: "Hedef A",
    });
    setupAdmin();

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Şikâyetler" }),
    ).toBeInTheDocument();
    expect(authMock).toHaveBeenCalled();
  });

  it("arama formu GET'tir ve mevcut durumu gizli input'ta korur", async () => {
    await makeReport({
      reporterName: "A",
      reason: "r1",
      status: "REVIEWING",
      targetTitle: "Hedef A",
    });
    setupAdmin();

    await renderPage({ durum: "REVIEWING", q: "hedef" });

    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/admin/sikayetler");
    expect(within(form).getByDisplayValue("hedef")).toHaveAttribute("name", "q");
    expect(within(form).getByDisplayValue("REVIEWING")).toHaveAttribute(
      "name",
      "durum",
    );
  });

  it("sekme bağlantıları mevcut q aramasını korur", async () => {
    await makeReport({
      reporterName: "A",
      reason: "r1",
      targetTitle: "Hedef A",
    });
    setupAdmin();

    await renderPage({ q: "hedef" });

    expect(screen.getByRole("link", { name: /İnceleniyor/ })).toHaveAttribute(
      "href",
      "/admin/sikayetler?q=hedef&durum=REVIEWING",
    );
  });
});
