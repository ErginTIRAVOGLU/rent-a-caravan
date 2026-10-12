// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// /hesap Genel Bakış — sunucu bileşeni doğrudan render edilir (admin
// page.test.tsx kalıbı). Oturum next-auth üzerinden, veri gerçek test DB'sinden
// gelir; oturumsuz çağrı requireUser -> /giris yönlendirmesi atmalıdır.

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
  usePathname: () => "/hesap",
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

async function renderDashboard() {
  const { default: HesapDashboardPage } = await import(
    "../../../src/app/hesap/page"
  );
  return render(await HesapDashboardPage());
}

describe("/hesap Genel Bakış", () => {
  it("oturum yoksa /giris'e yönlendirir", async () => {
    authMock.mockResolvedValue(null);

    const { default: HesapDashboardPage } = await import(
      "../../../src/app/hesap/page"
    );

    await expect(HesapDashboardPage()).rejects.toThrow();
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("yalnız ilanı olan kullanıcıda Gelen talepler kartı ve stat değerleri görünür", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    const renter = await prisma.user.create({
      data: makeUser({ email: "renter@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE", title: "Vito Camper" }),
    });

    const pending = await prisma.bookingRequest.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: new Date("2026-05-01"),
        endDate: new Date("2026-05-04"),
        guests: 3,
        totalPrice: 4500,
        status: "PENDING",
      },
    });
    const completed = await prisma.bookingRequest.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-03"),
        guests: 2,
        totalPrice: 3000,
        status: "COMPLETED",
      },
    });
    await prisma.review.create({
      data: {
        listingId: listing.id,
        authorId: renter.id,
        bookingId: pending.id,
        rating: 4,
      },
    });
    await prisma.review.create({
      data: {
        listingId: listing.id,
        authorId: renter.id,
        bookingId: completed.id,
        rating: 5,
      },
    });

    const conversation = await prisma.conversation.create({
      data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: renter.id,
        content: "Merhaba, müsait mi?",
      },
    });

    setupSession(owner);
    const { container } = await renderDashboard();

    expect(screen.getByText("Yayında ilan")).toBeInTheDocument();
    expect(screen.getByText("Bekleyen talep")).toBeInTheDocument();
    expect(screen.getByText("Ortalama puan")).toBeInTheDocument();
    expect(screen.getByText("Gelen talepler")).toBeInTheDocument();
    expect(screen.getByText("Giden talepler")).toBeInTheDocument();
    expect(screen.getAllByText("Vito Camper").length).toBeGreaterThan(0);

    const text = container.textContent ?? "";
    expect(text).toContain("4.5"); // (4 + 5) / 2
    expect(text).toContain("1"); // yayında ilan / bekleyen talep / okunmamış mesaj
    // İlanı olan kullanıcıda "İlan ver" boş durumu görünmez.
    expect(screen.queryByText("İlan ver")).not.toBeInTheDocument();
  });

  it("yalnız kiracıda İlan ver boş durumu görünür ve Giden talepler satırı vardır", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    const renter = await prisma.user.create({
      data: makeUser({ email: "renter@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE", title: "Sahibinden Karavan" }),
    });
    await prisma.bookingRequest.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-05"),
        guests: 2,
        totalPrice: 6000,
        status: "PENDING",
      },
    });

    setupSession(renter);
    const { container } = await renderDashboard();

    // Kullanıcının ilanı yok -> Gelen talepler yerine ilan verme CTA'sı.
    expect(screen.getAllByText("İlan ver").length).toBeGreaterThan(0);
    expect(screen.getByText("Henüz ilanınız yok")).toBeInTheDocument();

    // Giden taleplerde kiracının talebi listelenir; boş durum görünmez.
    expect(screen.getByText("Sahibinden Karavan")).toBeInTheDocument();
    expect(screen.queryByText("Karavan Ara")).not.toBeInTheDocument();

    const text = container.textContent ?? "";
    expect(text).toContain("6.000"); // formatTRY
  });

  it("sıfır veride iki boş durum görünür ve sayfada 0 rozeti/sayacı yok", async () => {
    const user = await prisma.user.create({
      data: makeUser({ email: "empty@test.com" }),
    });
    setupSession(user);

    const { container } = await renderDashboard();

    expect(screen.getByText("Henüz ilanınız yok")).toBeInTheDocument();
    expect(screen.getByText("Henüz talebiniz yok")).toBeInTheDocument();
    expect(screen.getByText("İlan ver")).toBeInTheDocument();
    expect(screen.getByText("Karavan Ara")).toBeInTheDocument();

    // Sıfır sayaçlar "0" olarak yazılmaz; hiçbir menü rozeti render edilmez.
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-testid^="nav-badge-"]').length,
    ).toBe(0);
  });
});
