// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// /admin/ilanlar — durum sekmeleri + sunucu tarafı `?q=` araması + tablo/kart.
// Sunucu bileşeni doğrudan render edilir (hesap/ilanlarim.test.tsx kalıbı):
// searchParams elle geçirilir, veri gerçek test DB'sinden gelir; oturum
// next-auth ile sahtelenir.

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
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
  usePathname: () => "/admin/ilanlar",
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
  const { default: AdminListingsPage } = await import(
    "../../../src/app/admin/ilanlar/page"
  );
  return render(
    await AdminListingsPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

describe("/admin/ilanlar", () => {
  it("metadata başlığı İlanlar", async () => {
    const { metadata } = await import("../../../src/app/admin/ilanlar/page");
    expect(metadata.title).toBe("İlanlar");
  });

  it("varsayılan sekme PENDING: yalnız incelemedeki ilanları gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Bekleyen İlan", status: "PENDING" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Yayındaki İlan", status: "ACTIVE" }),
    });
    setupAdmin();

    await renderPage();

    const table = screen.getByTestId("admin-listings-table");
    expect(within(table).getByText("Bekleyen İlan")).toBeInTheDocument();
    expect(within(table).queryByText("Yayındaki İlan")).not.toBeInTheDocument();
    expect(screen.getByTestId("tab-count-PENDING")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-ACTIVE")).toHaveTextContent("1");
  });

  it("geçersiz durum değeri PENDING (varsayılan) davranışına düşer", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Bekleyen İlan", status: "PENDING" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Yayındaki İlan", status: "ACTIVE" }),
    });
    setupAdmin();

    await renderPage({ durum: "gecersiz" });

    const table = screen.getByTestId("admin-listings-table");
    expect(within(table).getByText("Bekleyen İlan")).toBeInTheDocument();
    expect(within(table).queryByText("Yayındaki İlan")).not.toBeInTheDocument();
  });

  it("durum=ACTIVE yalnız aktif ilanları gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Bekleyen İlan", status: "PENDING" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Yayındaki İlan", status: "ACTIVE" }),
    });
    setupAdmin();

    await renderPage({ durum: "ACTIVE" });

    const table = screen.getByTestId("admin-listings-table");
    expect(within(table).getByText("Yayındaki İlan")).toBeInTheDocument();
    expect(within(table).queryByText("Bekleyen İlan")).not.toBeInTheDocument();
  });

  it("q başlığa büyük/küçük harf duyarsız contains uygular", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Ege Karavan", status: "PENDING" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Akdeniz Karavan", status: "PENDING" }),
    });
    setupAdmin();

    await renderPage({ q: "ege" });

    const table = screen.getByTestId("admin-listings-table");
    expect(within(table).getByText("Ege Karavan")).toBeInTheDocument();
    expect(within(table).queryByText("Akdeniz Karavan")).not.toBeInTheDocument();
  });

  it("sekme sayaçları q'dan bağımsız tam durum dağılımını gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Bir", status: "PENDING" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "İki", status: "PENDING" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Üç", status: "ACTIVE" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Dört", status: "PAUSED" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Beş", status: "REJECTED" }),
    });
    setupAdmin();

    await renderPage({ q: "Bir" });

    expect(screen.getByTestId("tab-count-PENDING")).toHaveTextContent("2");
    expect(screen.getByTestId("tab-count-ACTIVE")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-PAUSED")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-REJECTED")).toHaveTextContent("1");

    // Görünen liste q ile daraltılmıştır.
    const table = screen.getByTestId("admin-listings-table");
    expect(within(table).getByText("Bir")).toBeInTheDocument();
    expect(within(table).queryByText("İki")).not.toBeInTheDocument();
  });

  it("50 kayıt sınırı yoktur: 51 aktif ilanın tamamını render eder", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    for (let i = 0; i < 51; i += 1) {
      await prisma.listing.create({
        data: makeListing(owner.id, {
          title: `İlan ${i}`,
          status: "ACTIVE",
        }),
      });
    }
    setupAdmin();

    await renderPage({ durum: "ACTIVE" });

    const table = screen.getByTestId("admin-listings-table");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(51);
  });

  it("filtre sonucu boşsa tek EmptyState ve tek 'Aramayı temizle' linki gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Ege Karavan", status: "PENDING" }),
    });
    setupAdmin();

    await renderPage({ q: "zzz-eslesmez" });

    expect(
      screen.getByText("Aramanızla eşleşen ilan yok"),
    ).toBeInTheDocument();
    const clearLinks = screen.getAllByRole("link", { name: "Aramayı temizle" });
    expect(clearLinks).toHaveLength(1);
    expect(clearLinks[0]).toHaveAttribute("href", "/admin/ilanlar");
    expect(screen.queryByTestId("admin-listings-table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-listings-cards")).not.toBeInTheDocument();
  });

  it("seçili sekme boşsa tek CTA'lı boş durum gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Yayındaki", status: "ACTIVE" }),
    });
    setupAdmin();

    await renderPage({ durum: "PAUSED" });

    expect(screen.getByText("Askıda ilan yok")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    // Tek CTA: Genel Bakışa dönüş.
    const cta = links.filter((link) => link.textContent === "Genel Bakışa dön");
    expect(cta).toHaveLength(1);
    expect(cta[0]).toHaveAttribute("href", "/admin");
  });

  it("masaüstü tablo ve mobil kart aynı veriyi taşır", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ name: "Sahip Kişi", email: "sahip@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, {
        title: "Reddedilen Karavan",
        city: "İzmir",
        nightlyPrice: 2000,
        capacity: 6,
        status: "REJECTED",
        rejectionReason: "Belgeler eksik.",
      }),
    });
    setupAdmin();

    await renderPage({ durum: "REJECTED" });

    for (const testid of ["admin-listings-table", "admin-listings-cards"]) {
      const scope = screen.getByTestId(testid);
      expect(within(scope).getByText("Reddedilen Karavan")).toBeInTheDocument();
      expect(within(scope).getByText(/İzmir/)).toBeInTheDocument();
      expect(within(scope).getByText(/2\.000/)).toBeInTheDocument();
      expect(within(scope).getByText("6 kişi")).toBeInTheDocument();
      expect(within(scope).getByText("Reddedildi")).toBeInTheDocument();
      expect(within(scope).getByText(/Sahip Kişi/)).toBeInTheDocument();
      expect(within(scope).getByText(/sahip@test\.com/)).toBeInTheDocument();
      expect(
        within(scope).getByText(/Belgeler eksik\./),
      ).toBeInTheDocument();
      expect(within(scope).getByRole("link", { name: "İncele" })).toHaveAttribute(
        "href",
        `/admin/ilanlar/${listing.id}`,
      );
    }
  });

  it("arama formu GET'tir ve varsayılan olmayan durumu gizli input'ta korur", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Ege", status: "ACTIVE" }),
    });
    setupAdmin();

    await renderPage({ durum: "ACTIVE", q: "ege" });

    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/admin/ilanlar");
    expect(within(form).getByDisplayValue("ege")).toHaveAttribute("name", "q");
    expect(within(form).getByDisplayValue("ACTIVE")).toHaveAttribute(
      "name",
      "durum",
    );
  });

  it("varsayılan PENDING sekmesinde arama formu durum gizli input'u taşımaz", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Bekleyen", status: "PENDING" }),
    });
    setupAdmin();

    await renderPage({ q: "bek" });

    const form = screen.getByRole("search");
    expect(form.querySelector('input[name="durum"]')).toBeNull();
  });

  it("sekme bağlantıları mevcut q aramasını korur", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Ege", status: "PENDING" }),
    });
    setupAdmin();

    await renderPage({ q: "ege" });

    expect(screen.getByRole("link", { name: /Yayında/ })).toHaveAttribute(
      "href",
      "/admin/ilanlar?q=ege&durum=ACTIVE",
    );
  });
});
