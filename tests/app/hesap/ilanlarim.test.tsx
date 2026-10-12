// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// /hesap/ilanlarim — durum sekmeleri + arama + tablo. Sunucu bileşeni doğrudan
// render edilir (dashboard.test.tsx kalıbı): searchParams elle geçirilir, veri
// gerçek test DB'sinden gelir; oturum next-auth ile sahtelenir.

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

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/hesap/ilanlarim",
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

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

function setupSession(user: { id: string; name: string; email: string }) {
  authMock.mockResolvedValue({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: "USER",
      isBanned: false,
    },
  });
}

async function renderListings(searchParams: Record<string, string> = {}) {
  const { default: IlanlarimPage } = await import(
    "../../../src/app/hesap/ilanlarim/page"
  );
  return render(
    await IlanlarimPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

describe("/hesap/ilanlarim", () => {
  it("metadata başlığı İlanlarım", async () => {
    const { metadata } = await import(
      "../../../src/app/hesap/ilanlarim/page"
    );
    expect(metadata.title).toBe("İlanlarım");
  });

  it("durum=ACTIVE yalnız ACTIVE ilanları gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Aktif Karavan", status: "ACTIVE" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Taslak Karavan", status: "DRAFT" }),
    });
    setupSession(owner);

    await renderListings({ durum: "ACTIVE" });

    const table = screen.getByTestId("listings-table");
    expect(within(table).getByText("Aktif Karavan")).toBeInTheDocument();
    expect(within(table).queryByText("Taslak Karavan")).not.toBeInTheDocument();

    const cards = screen.getByTestId("listings-cards");
    expect(within(cards).getByText("Aktif Karavan")).toBeInTheDocument();
    expect(within(cards).queryByText("Taslak Karavan")).not.toBeInTheDocument();
  });

  it("durum=gecersiz (geçersiz değer) all davranışına düşer", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Aktif Karavan", status: "ACTIVE" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Taslak Karavan", status: "DRAFT" }),
    });
    setupSession(owner);

    await renderListings({ durum: "gecersiz" });

    const table = screen.getByTestId("listings-table");
    expect(within(table).getByText("Aktif Karavan")).toBeInTheDocument();
    expect(within(table).getByText("Taslak Karavan")).toBeInTheDocument();
  });

  it("q başlığa büyük/küçük harf duyarsız contains uygular", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Ege Karavan", status: "ACTIVE" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Akdeniz Karavan", status: "ACTIVE" }),
    });
    setupSession(owner);

    await renderListings({ q: "ege" });

    const table = screen.getByTestId("listings-table");
    expect(within(table).getByText("Ege Karavan")).toBeInTheDocument();
    expect(within(table).queryByText("Akdeniz Karavan")).not.toBeInTheDocument();
  });

  it("sekme sayaçları q'dan bağımsız tam durum dağılımını gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Aktif Bir", status: "ACTIVE" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Aktif İki", status: "ACTIVE" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Taslak", status: "DRAFT" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Reddedilen", status: "REJECTED" }),
    });
    setupSession(owner);

    // q yalnız bir alt kümeyi eşler; sayaçlar tüm dağılımı gösterir.
    await renderListings({ q: "Aktif Bir" });

    expect(screen.getByTestId("tab-count-all")).toHaveTextContent("4");
    expect(screen.getByTestId("tab-count-ACTIVE")).toHaveTextContent("2");
    expect(screen.getByTestId("tab-count-DRAFT")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-REJECTED")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-PENDING")).toHaveTextContent("0");
    expect(screen.getByTestId("tab-count-PAUSED")).toHaveTextContent("0");

    // Görünen liste ise q ile daraltılmıştır.
    const table = screen.getByTestId("listings-table");
    expect(within(table).getByText("Aktif Bir")).toBeInTheDocument();
    expect(within(table).queryByText("Aktif İki")).not.toBeInTheDocument();
  });

  it("hiç ilanı olmayanda tek CTA'lı boş durum gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    setupSession(owner);

    await renderListings();

    expect(screen.getByText("Henüz ilanınız yok")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "İlk ilanınızı oluşturun" }),
    ).toHaveLength(1);
    expect(screen.getByRole("link", { name: "İlk ilanınızı oluşturun" })).toHaveAttribute(
      "href",
      "/hesap/ilanlarim/yeni",
    );
    expect(screen.queryByTestId("listings-table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("listings-cards")).not.toBeInTheDocument();
  });

  it("filtre sonucu boş olduğunda yine tek CTA'lı boş durum gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Ege Karavan", status: "ACTIVE" }),
    });
    setupSession(owner);

    await renderListings({ q: "zzz-eslesmez" });

    expect(screen.getByText("Aramanızla eşleşen ilan yok")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "İlk ilanınızı oluşturun" }),
    ).toHaveLength(1);
    expect(screen.queryByTestId("listings-table")).not.toBeInTheDocument();
    // Sekmeler ve sayaçlar filtre olsa da görünür kalır.
    expect(screen.getByTestId("tab-count-all")).toHaveTextContent("1");
  });

  it("her satır hem masaüstü tablo hücresinde hem mobil kartta aynı veriyi taşır", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, {
        title: "Ege Karavan",
        city: "İzmir",
        nightlyPrice: 2000,
        capacity: 6,
        status: "ACTIVE",
      }),
    });
    setupSession(owner);

    await renderListings();

    for (const testid of ["listings-table", "listings-cards"]) {
      const scope = screen.getByTestId(testid);
      expect(within(scope).getByText("Ege Karavan")).toBeInTheDocument();
      expect(within(scope).getByText("İzmir")).toBeInTheDocument();
      expect(within(scope).getByText(/2\.000/)).toBeInTheDocument();
      expect(within(scope).getByText("6 kişi")).toBeInTheDocument();
      expect(within(scope).getByText("Yayında")).toBeInTheDocument();
      expect(within(scope).getByRole("button", { name: "Sil" })).toBeInTheDocument();
      expect(within(scope).getByRole("link", { name: "Geçmiş" })).toHaveAttribute(
        "href",
        `/hesap/ilanlarim/${listing.id}/gecmis`,
      );
    }
  });

  it("sekme bağlantıları mevcut q aramasını korur", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Ege Karavan", status: "ACTIVE" }),
    });
    setupSession(owner);

    await renderListings({ q: "ege" });

    expect(screen.getByRole("link", { name: /Yayında/ })).toHaveAttribute(
      "href",
      "/hesap/ilanlarim?q=ege&durum=ACTIVE",
    );
  });

  it("arama formu sunucu GET formudur ve mevcut durumu gizli input'ta korur", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    await prisma.listing.create({
      data: makeListing(owner.id, { title: "Ege Karavan", status: "ACTIVE" }),
    });
    setupSession(owner);

    await renderListings({ durum: "ACTIVE", q: "ege" });

    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/hesap/ilanlarim");
    expect(within(form).getByDisplayValue("ege")).toHaveAttribute("name", "q");
    expect(within(form).getByDisplayValue("ACTIVE")).toHaveAttribute(
      "name",
      "durum",
    );
  });
});
