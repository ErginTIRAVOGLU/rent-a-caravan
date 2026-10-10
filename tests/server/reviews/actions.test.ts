import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// Hoisted auth mock — next-auth mock factory bu fonksiyonu döndürür.
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
}));

// Mock next/headers for IP capture
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { headers } from "next/headers";

import {
  createReview,
  deleteReview,
  updateReview,
  updateReviewsVisible,
} from "../../../src/server/reviews/actions";

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(
    new Headers({ "x-forwarded-for": "198.51.100.10" }),
  );
});

async function makeCompletedBooking(listingId: string, renterId: string) {
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

function sessionFor(user: { id: string; name: string; email: string }) {
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

describe("createReview action", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let booking: Awaited<ReturnType<typeof makeCompletedBooking>>;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    booking = await makeCompletedBooking(listing.id, renter.id);
  });

  it("oturumlu kullanıcı yorum oluşturur, IP headers'dan gelir", async () => {
    sessionFor(renter);

    const result = await createReview(listing.id, booking.id, 5, "Süper!");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ipAddress).toBe("198.51.100.10");
      expect(result.data.rating).toBe(5);
    }
  });

  it("oturum yoksa redirect atar (requireUser)", async () => {
    authMock.mockResolvedValue(null);

    await expect(createReview(listing.id, booking.id, 5)).rejects.toThrow();
  });

  it("PENDING booking → fail", async () => {
    sessionFor(renter);

    const pendingBooking = await prisma.bookingRequest.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-05"),
        guests: 2,
        totalPrice: 6000,
        status: "PENDING",
      },
    });

    const result = await createReview(listing.id, pendingBooking.id, 5);

    expect(result.ok).toBe(false);
  });
});

describe("updateReview action", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let reviewId: string;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    const booking = await makeCompletedBooking(listing.id, renter.id);
    sessionFor(renter);
    const result = await createReview(listing.id, booking.id, 3);
    reviewId = result.ok ? result.data.id : "";
  });

  it("yazar günceller", async () => {
    sessionFor(renter);

    const result = await updateReview(reviewId, 5, "Güncellendi");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rating).toBe(5);
      expect(result.data.comment).toBe("Güncellendi");
    }
  });

  it("başkası güncelleyemez", async () => {
    const other = await prisma.user.create({ data: makeUser({ email: "other@test.com" }) });
    sessionFor(other);

    const result = await updateReview(reviewId, 1);

    expect(result.ok).toBe(false);
  });
});

describe("deleteReview action", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let reviewId: string;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    const booking = await makeCompletedBooking(listing.id, renter.id);
    sessionFor(renter);
    const result = await createReview(listing.id, booking.id, 3);
    reviewId = result.ok ? result.data.id : "";
  });

  it("yazar siler", async () => {
    sessionFor(renter);

    const result = await deleteReview(reviewId);

    expect(result.ok).toBe(true);
  });

  it("oturum yoksa redirect atar", async () => {
    authMock.mockResolvedValue(null);

    await expect(deleteReview(reviewId)).rejects.toThrow();
  });
});

describe("updateReviewsVisible action", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
  });

  it("görünürlük güncellenir", async () => {
    sessionFor(owner);

    const result = await updateReviewsVisible(false);

    expect(result.ok).toBe(true);
    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(updated.reviewsVisible).toBe(false);
  });
});
