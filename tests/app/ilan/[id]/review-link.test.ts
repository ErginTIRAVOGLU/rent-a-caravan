// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { prisma } from "../../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../../helpers/db";

// /ilan/[id] — "Değerlendir" bağlantısı: yalnız COMPLETED + kendi
// booking'i + mevcut yorum yoksa görünür (yorum-yaz sayfasıyla aynı kapı).

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
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
  redirect: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/ilan/test-id",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
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

async function renderListingPage(id: string) {
  const { default: IlanDetayPage } = await import(
    "../../../../src/app/ilan/[id]/page"
  );
  return render(
    await IlanDetayPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    }),
  );
}

async function createCompletedBooking(listingId: string, renterId: string) {
  return prisma.bookingRequest.create({
    data: {
      listingId,
      renterId,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-05"),
      guests: 2,
      totalPrice: 6000,
      status: "COMPLETED",
    },
  });
}

describe("/ilan/[id] — Değerlendir bağlantısı", () => {
  it("uygun kiracı bağlantıyı görür (/ilan/[id]/yorum-yaz'a gider)", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    const renter = await prisma.user.create({
      data: makeUser({ email: "renter@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    await createCompletedBooking(listing.id, renter.id);
    setupSession(renter);

    const { getByRole } = await renderListingPage(listing.id);

    const link = getByRole("link", { name: "Değerlendir" });
    expect(link.getAttribute("href")).toBe(`/ilan/${listing.id}/yorum-yaz`);
  });

  it("ilan sahibi bağlantıyı görmez", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    setupSession(owner);

    const { queryByRole } = await renderListingPage(listing.id);

    expect(queryByRole("link", { name: "Değerlendir" })).not.toBeInTheDocument();
  });

  it("COMPLETED booking'i olmayan kiracı bağlantıyı görmez", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    const renter = await prisma.user.create({
      data: makeUser({ email: "renter@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    setupSession(renter);

    const { queryByRole } = await renderListingPage(listing.id);

    expect(queryByRole("link", { name: "Değerlendir" })).not.toBeInTheDocument();
  });

  it("zaten yorum yazmış kiracı bağlantıyı görmez", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    const renter = await prisma.user.create({
      data: makeUser({ email: "renter@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    const booking = await createCompletedBooking(listing.id, renter.id);
    await prisma.review.create({
      data: {
        listingId: listing.id,
        authorId: renter.id,
        bookingId: booking.id,
        rating: 5,
      },
    });
    setupSession(renter);

    const { queryByRole } = await renderListingPage(listing.id);

    expect(queryByRole("link", { name: "Değerlendir" })).not.toBeInTheDocument();
  });
});
