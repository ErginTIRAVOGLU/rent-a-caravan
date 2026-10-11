import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { JSDOM } from "jsdom";

import { prisma } from "../../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../../helpers/db";

// Hoisted auth mock
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
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
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/ilan/c1234567890123456789012345/yorum-yaz",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

// jsdom setup
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost",
});
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
// Node.js 21+ global.navigator salt okunur — defineProperty ile override.
Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  writable: true,
  configurable: true,
});
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

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

describe("/ilan/[id]/yorum-yaz page", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;

  it("COMPLETED booking + mevcut yorum yok → form gösterilir", async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    await prisma.bookingRequest.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-05"),
        guests: 2,
        totalPrice: 6000,
        status: "COMPLETED",
      },
    });

    setupSession(renter);

    const { default: YorumYazPage } = await import(
      "../../../../src/app/ilan/[id]/yorum-yaz/page"
    );
    const { getByText } = render(
      await YorumYazPage({ params: Promise.resolve({ id: listing.id }) }),
    );

    expect(getByText("Yorum Yaz")).toBeInTheDocument();
    expect(getByText("Puanınız")).toBeInTheDocument();
    expect(getByText("Yorumunuz (opsiyonel)")).toBeInTheDocument();
  });

  it("COMPLETED booking yok → bilgi mesajı gösterilir", async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });

    setupSession(renter);

    const { default: YorumYazPage } = await import(
      "../../../../src/app/ilan/[id]/yorum-yaz/page"
    );
    const { getByText } = render(
      await YorumYazPage({ params: Promise.resolve({ id: listing.id }) }),
    );

    expect(
      getByText(/tamamlanmış bir rezervasyonunuz olmalı/i),
    ).toBeInTheDocument();
  });

  it("mevcut yorum var → bilgi mesajı gösterilir", async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    const booking = await prisma.bookingRequest.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-05"),
        guests: 2,
        totalPrice: 6000,
        status: "COMPLETED",
      },
    });
    await prisma.review.create({
      data: {
        listingId: listing.id,
        authorId: renter.id,
        bookingId: booking.id,
        rating: 4,
      },
    });

    setupSession(renter);

    const { default: YorumYazPage } = await import(
      "../../../../src/app/ilan/[id]/yorum-yaz/page"
    );
    const { getByText } = render(
      await YorumYazPage({ params: Promise.resolve({ id: listing.id }) }),
    );

    expect(getByText(/zaten yorum yazmışsınız/i)).toBeInTheDocument();
  });
});
