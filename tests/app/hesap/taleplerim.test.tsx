// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// /hesap/taleplerim — Gelen/Giden ana sekmeleri + durum filtreleri + tablo.
// Sunucu bileşeni doğrudan render edilir (ilanlarim.test.tsx kalıbı):
// searchParams elle geçirilir, veri gerçek test DB'sinden gelir; oturum
// next-auth ile sahtelenir. Aynı anda YALNIZ bir liste render edilmelidir.

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
  usePathname: () => "/hesap/taleplerim",
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

async function renderRequests(searchParams: Record<string, string> = {}) {
  const { default: TaleplerimPage } = await import(
    "../../../src/app/hesap/taleplerim/page"
  );
  return render(
    await TaleplerimPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

/** Kullanıcıya gelen (kullanıcı ilan sahibi) bir talep oluşturur. */
async function makeIncoming(
  ownerId: string,
  renterId: string,
  listingId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.bookingRequest.create({
    data: {
      listingId,
      renterId,
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-05-04"),
      guests: 3,
      totalPrice: 4500,
      status: "PENDING",
      ...overrides,
    },
  });
}

/** Kullanıcının kiracı olduğu (giden) bir talep oluşturur. */
async function makeOutgoing(
  listingId: string,
  renterId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.bookingRequest.create({
    data: {
      listingId,
      renterId,
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-05"),
      guests: 2,
      totalPrice: 6000,
      status: "PENDING",
      ...overrides,
    },
  });
}

describe("/hesap/taleplerim", () => {
  it("metadata başlığı Taleplerim", async () => {
    const { metadata } = await import(
      "../../../src/app/hesap/taleplerim/page"
    );
    expect(metadata.title).toBe("Taleplerim");
  });

  it("varsayılan olarak gelen listesini ve sayaçlı sekmeleri gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({ data: makeUser() });
    const otherRenter = await prisma.user.create({ data: makeUser() });
    const otherOwner = await prisma.user.create({ data: makeUser() });

    const ownListing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Sahibin Karavanı" }),
    });
    const secondOwnListing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "İkinci Karavan" }),
    });
    const otherListing = await prisma.listing.create({
      data: makeListing(otherOwner.id, { title: "Kiracı Karavanı" }),
    });

    await makeIncoming(owner.id, renter.id, ownListing.id, {
      status: "PENDING",
    });
    await makeIncoming(owner.id, otherRenter.id, secondOwnListing.id, {
      status: "REJECTED",
    });
    await makeOutgoing(otherListing.id, owner.id, { status: "PENDING" });

    setupSession(owner);
    await renderRequests();

    // Ana sekme sayaçları: yön toplamları (kullanıcı kapsamlı).
    expect(screen.getByTestId("tab-count-incoming")).toHaveTextContent("2");
    expect(screen.getByTestId("tab-count-outgoing")).toHaveTextContent("1");

    // Durum sayaçları seçili yöne (gelen) göre.
    expect(screen.getByTestId("tab-count-all")).toHaveTextContent("2");
    expect(screen.getByTestId("tab-count-PENDING")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-REJECTED")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-APPROVED")).toHaveTextContent("0");

    // Yalnız gelen liste render edilir.
    const table = screen.getByTestId("requests-table");
    expect(table).toHaveAttribute("data-direction", "incoming");
    expect(within(table).getByText("Sahibin Karavanı")).toBeInTheDocument();
    expect(
      screen.queryByText("Kiracı Karavanı"),
    ).not.toBeInTheDocument();
  });

  it("sekme=outgoing & durum=REJECTED yalnız reddedilen gidenleri gerekçesiyle gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renterOwner = await prisma.user.create({ data: makeUser() });
    const otherOwner = await prisma.user.create({ data: makeUser() });

    const rejectedListing = await prisma.listing.create({
      data: makeListing(otherOwner.id, { title: "Reddedilen Karavan" }),
    });
    const approvedListing = await prisma.listing.create({
      data: makeListing(otherOwner.id, { title: "Onaylı Karavan" }),
    });
    const incomingListing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Gelen Karavan" }),
    });

    await makeOutgoing(rejectedListing.id, owner.id, {
      status: "REJECTED",
      rejectionReason: "Tarihler dolu",
    });
    await makeOutgoing(approvedListing.id, owner.id, { status: "APPROVED" });
    await makeIncoming(owner.id, renterOwner.id, incomingListing.id, {
      status: "PENDING",
    });

    setupSession(owner);
    await renderRequests({ sekme: "outgoing", durum: "REJECTED" });

    const table = screen.getByTestId("requests-table");
    expect(table).toHaveAttribute("data-direction", "outgoing");
    expect(within(table).getByText("Reddedilen Karavan")).toBeInTheDocument();
    expect(
      within(table).getByText("Red gerekçesi: Tarihler dolu"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Onaylı Karavan"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Gelen Karavan")).not.toBeInTheDocument();

    // Sayaçlar durum filtresinden bağımsız tam dağılımı gösterir.
    expect(screen.getByTestId("tab-count-all")).toHaveTextContent("2");
    expect(screen.getByTestId("tab-count-REJECTED")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-APPROVED")).toHaveTextContent("1");
  });

  it("iki liste aynı anda DOM'da render edilmez (gelen seçili)", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({ data: makeUser() });
    const otherOwner = await prisma.user.create({ data: makeUser() });

    const ownListing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Sahibin Karavanı" }),
    });
    const otherListing = await prisma.listing.create({
      data: makeListing(otherOwner.id, { title: "Kiracı Karavanı" }),
    });
    await makeIncoming(owner.id, renter.id, ownListing.id);
    await makeOutgoing(otherListing.id, owner.id);

    setupSession(owner);
    await renderRequests({ sekme: "incoming" });

    expect(screen.getAllByTestId("requests-table")).toHaveLength(1);
    expect(screen.getAllByTestId("requests-cards")).toHaveLength(1);
    expect(screen.getByTestId("requests-table")).toHaveAttribute(
      "data-direction",
      "incoming",
    );
    expect(screen.queryByText("Kiracı Karavanı")).not.toBeInTheDocument();
  });

  it("iki liste aynı anda DOM'da render edilmez (giden seçili)", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({ data: makeUser() });
    const otherOwner = await prisma.user.create({ data: makeUser() });

    const ownListing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Sahibin Karavanı" }),
    });
    const otherListing = await prisma.listing.create({
      data: makeListing(otherOwner.id, { title: "Kiracı Karavanı" }),
    });
    await makeIncoming(owner.id, renter.id, ownListing.id);
    await makeOutgoing(otherListing.id, owner.id);

    setupSession(owner);
    await renderRequests({ sekme: "outgoing" });

    expect(screen.getByTestId("requests-table")).toHaveAttribute(
      "data-direction",
      "outgoing",
    );
    expect(screen.queryByText("Sahibin Karavanı")).not.toBeInTheDocument();
  });

  it("gelen talebi yoksa CTA'sız boş durum gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    setupSession(owner);

    await renderRequests();

    expect(screen.getByText("Henüz gelen talep yok")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Karavan Ara" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("requests-table")).not.toBeInTheDocument();
  });

  it("giden talebi yoksa 'Karavan Ara' CTA'lı boş durum gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    setupSession(owner);

    await renderRequests({ sekme: "outgoing" });

    expect(screen.getByText("Henüz talebiniz yok")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Karavan Ara" });
    expect(cta).toHaveAttribute("href", "/arama");
  });

  it("durum filtresi listeyi daraltır ama sayaçlar tüm dağılımı korur", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({ data: makeUser() });
    const otherRenter = await prisma.user.create({ data: makeUser() });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Sahibin Karavanı" }),
    });
    await makeIncoming(owner.id, renter.id, listing.id, {
      status: "PENDING",
    });
    await makeIncoming(owner.id, otherRenter.id, listing.id, {
      status: "COMPLETED",
    });

    setupSession(owner);
    await renderRequests({ durum: "APPROVED" });

    // Liste boş (APPROVED yok) ama sayaçlar tam dağılımı gösterir.
    expect(screen.queryByTestId("requests-table")).not.toBeInTheDocument();
    expect(screen.getByTestId("tab-count-all")).toHaveTextContent("2");
    expect(screen.getByTestId("tab-count-PENDING")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-COMPLETED")).toHaveTextContent("1");
  });

  it("gelen satır hem tabloda hem kartta aynı veriyi taşır", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({
      data: makeUser({ name: "Ali Kiracı" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Ege Karavan" }),
    });
    await makeIncoming(owner.id, renter.id, listing.id, {
      message: "Merhaba, müsait mi?",
    });

    setupSession(owner);
    await renderRequests();

    for (const testid of ["requests-table", "requests-cards"]) {
      const scope = screen.getByTestId(testid);
      expect(within(scope).getByText("Ege Karavan")).toBeInTheDocument();
      expect(within(scope).getByText(/Ali Kiracı/)).toBeInTheDocument();
      expect(
        within(scope).getByText(/01\.05\.2026 – 04\.05\.2026/),
      ).toBeInTheDocument();
      expect(within(scope).getByText(/3 kişi/)).toBeInTheDocument();
      expect(within(scope).getByText(/4\.500/)).toBeInTheDocument();
      expect(within(scope).getByText("Bekliyor")).toBeInTheDocument();
      expect(
        within(scope).getByText(/Merhaba, müsait mi\?/),
      ).toBeInTheDocument();
      expect(
        within(scope).getByRole("button", { name: "Onayla" }),
      ).toBeInTheDocument();
    }
  });

  it("giden PENDING/APPROVED satırda İptal Et, REJECTED satırda gerekçe gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const otherOwner = await prisma.user.create({ data: makeUser() });
    const pendingListing = await prisma.listing.create({
      data: makeListing(otherOwner.id, {
        title: "Bekleyen Karavan",
        status: "PAUSED",
      }),
    });
    const rejectedListing = await prisma.listing.create({
      data: makeListing(otherOwner.id, { title: "Reddedilen Karavan" }),
    });
    await makeOutgoing(pendingListing.id, owner.id, { status: "PENDING" });
    await makeOutgoing(rejectedListing.id, owner.id, {
      status: "REJECTED",
      rejectionReason: "Sigorta eksik",
    });

    setupSession(owner);
    await renderRequests({ sekme: "outgoing" });

    const table = screen.getByTestId("requests-table");
    // Giden satırda ilan durumu görünür (PAUSED → Askıda).
    expect(within(table).getByText("Askıda")).toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: "İptal Et" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByText("Red gerekçesi: Sigorta eksik"),
    ).toBeInTheDocument();
  });

  it("sekme bağlantıları diğer filtreyi korur", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({ data: makeUser() });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Sahibin Karavanı" }),
    });
    await makeIncoming(owner.id, renter.id, listing.id, { status: "PENDING" });

    setupSession(owner);
    await renderRequests({ sekme: "outgoing", durum: "PENDING" });

    // Ana sekme: gelen seçimi sekme'yi düşürür, durum korunur.
    expect(screen.getByRole("link", { name: /Gelen/ })).toHaveAttribute(
      "href",
      "/hesap/taleplerim?durum=PENDING",
    );
    // Durum sekmesi: sekme korunur, durum değişir.
    expect(screen.getByRole("link", { name: /Onaylandı/ })).toHaveAttribute(
      "href",
      "/hesap/taleplerim?sekme=outgoing&durum=APPROVED",
    );
  });
});
