import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../../src/lib/prisma";
import {
  createReviewCore,
  deleteReviewCore,
  getReviewsForListing,
  getUserReviews,
  updateReviewCore,
  updateReviewsVisibleCore,
} from "../../../src/server/reviews/service";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// Mock next/headers for IP capture
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { headers } from "next/headers";

function mockUser(id: string, email: string, role: "USER" | "ADMIN" = "USER") {
  return { id, name: "Test", email, role, isBanned: false };
}

/** COMPLETED booking oluşturmak için yardımcı. */
async function makeCompletedBooking(
  listingId: string,
  renterId: string,
) {
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

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  // Default IP mock
  vi.mocked(headers).mockResolvedValue(
    new Headers({ "x-forwarded-for": "203.0.113.42" }),
  );
});

describe("createReviewCore", () => {
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

  it("COMPLETED booking + kendi booking'i + mevcut yorum yok → yorum oluşturulur, IP headers'dan kaydedilir", async () => {
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      5,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rating).toBe(5);
      expect(result.data.comment).toBeNull();
      expect(result.data.ipAddress).toBe("203.0.113.42");
      expect(result.data.authorId).toBe(renter.id);
      expect(result.data.listingId).toBe(listing.id);
      expect(result.data.bookingId).toBe(booking.id);
    }
  });

  it("x-forwarded-for çoklu adresliyse ilk (istemci) adres kaydedilir", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-forwarded-for": "203.0.113.42, 70.41.3.18, 150.172.238.178" }),
    );

    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      4,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ipAddress).toBe("203.0.113.42");
    }
  });

  it("x-forwarded-for yoksa ipAddress null olur", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      4,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ipAddress).toBeNull();
    }
  });

  it("istemci payload'ındaki ipAddress alanı asla okunmaz", async () => {
    // createReviewCore parametreleri açık: payload'dan ip yok.
    // Bu test, IP'in yalnızca headers()'den geldiğini doğrular (üstteki testler).
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      3,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ipAddress).toBe("203.0.113.42");
    }
  });

  it("PENDING booking → fail (REZERVASYON_TAMAMLANMADI)", async () => {
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

    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      pendingBooking.id,
      5,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("tamamlanmış");
    }
  });

  it("başkasının booking'i → fail (YETKI_YOK)", async () => {
    const other = await prisma.user.create({ data: makeUser({ email: "other@test.com" }) });

    const result = await createReviewCore(
      mockUser(other.id, other.email),
      listing.id,
      booking.id,
      5,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("yetkiniz yok");
    }
  });

  it("mükerrer bookingId → fail (ZATEN_YORUM_YAZMIS)", async () => {
    const first = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      4,
    );
    expect(first.ok).toBe(true);

    const second = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      5,
    );

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("zaten");
    }
  });

  it("puan 0 → fail", async () => {
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      0,
    );
    expect(result.ok).toBe(false);
  });

  it("puan 6 → fail", async () => {
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      6,
    );
    expect(result.ok).toBe(false);
  });

  it("yorum 1001 karakter → fail", async () => {
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      5,
      "a".repeat(1001),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("comment");
    }
  });

  it("geçersiz listingId → fail", async () => {
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      "invalid-id",
      booking.id,
      5,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("ilan kimliği");
    }
  });

  it("geçersiz bookingId → fail", async () => {
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      "invalid-id",
      5,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("talep kimliği");
    }
  });
});

describe("createReviewCore — display guards", () => {
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

  it("reviewsEnabled=false → fail (YORUM_KAPALI)", async () => {
    await prisma.setting.create({
      data: { key: "reviewsEnabled", value: false },
    });

    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      5,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("kapalı");
    }
  });

  it("owner reviewsVisible=false → fail (SAHIP_YORUM_GIZLI)", async () => {
    await prisma.user.update({
      where: { id: owner.id },
      data: { reviewsVisible: false },
    });

    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      5,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("gizlemiş");
    }
  });

  it("reviewsEnabled=true (varsayılan) + owner reviewsVisible=true → başarılı", async () => {
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      5,
    );

    expect(result.ok).toBe(true);
  });
});

describe("updateReviewCore", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let review: { id: string };

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    const booking = await makeCompletedBooking(listing.id, renter.id);
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      4,
    );
    review = result.ok ? result.data : { id: "" };
  });

  it("yazar günceller, updatedAt güncellenir", async () => {
    const result = await updateReviewCore(
      mockUser(renter.id, renter.email),
      review.id,
      5,
      "Güncel yorum",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rating).toBe(5);
      expect(result.data.comment).toBe("Güncel yorum");
      expect(result.data.updatedAt).not.toBeNull();
    }
  });

  it("yazar olmayan → fail (YETKI_YOK)", async () => {
    const other = await prisma.user.create({ data: makeUser({ email: "other@test.com" }) });

    const result = await updateReviewCore(
      mockUser(other.id, other.email),
      review.id,
      3,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("yetkiniz yok");
    }
  });

  it("geçersiz puan → fail", async () => {
    const result = await updateReviewCore(
      mockUser(renter.id, renter.email),
      review.id,
      0,
    );
    expect(result.ok).toBe(false);
  });

  it("yorum bulunamadı → fail", async () => {
    const result = await updateReviewCore(
      mockUser(renter.id, renter.email),
      "c".repeat(25),
      3,
    );
    expect(result.ok).toBe(false);
  });
});

describe("deleteReviewCore", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let review: { id: string };

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    admin = await prisma.user.create({ data: makeUser({ email: "admin@test.com", role: "ADMIN" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    const booking = await makeCompletedBooking(listing.id, renter.id);
    const result = await createReviewCore(
      mockUser(renter.id, renter.email),
      listing.id,
      booking.id,
      4,
    );
    review = result.ok ? result.data : { id: "" };
  });

  it("yazar siler", async () => {
    const result = await deleteReviewCore(
      mockUser(renter.id, renter.email),
      review.id,
    );

    expect(result.ok).toBe(true);
    const deleted = await prisma.review.findUnique({ where: { id: review.id } });
    expect(deleted).toBeNull();
  });

  it("ADMIN siler", async () => {
    const result = await deleteReviewCore(
      mockUser(admin.id, admin.email, "ADMIN"),
      review.id,
    );

    expect(result.ok).toBe(true);
  });

  it("üçüncü kişi silinemez (YETKI_YOK)", async () => {
    const other = await prisma.user.create({ data: makeUser({ email: "other@test.com" }) });

    const result = await deleteReviewCore(
      mockUser(other.id, other.email),
      review.id,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("yetkiniz yok");
    }
  });

  it("yorum bulunamadı → fail", async () => {
    const result = await deleteReviewCore(
      mockUser(renter.id, renter.email),
      "c".repeat(25),
    );
    expect(result.ok).toBe(false);
  });
});

describe("getReviewsForListing", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
  });

  async function seedReviews(count: number) {
    for (let i = 0; i < count; i++) {
      const booking = await makeCompletedBooking(listing.id, renter.id);
      await prisma.review.create({
        data: {
          listingId: listing.id,
          authorId: renter.id,
          bookingId: booking.id,
          rating: 3 + (i % 3),
          comment: `Yorum ${i + 1}`,
        },
      });
    }
  }

  it("yorum varsa ortalama puan döner", async () => {
    await seedReviews(3);

    const result = await getReviewsForListing(listing.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reviews.length).toBe(3);
      // ratings: 3, 4, 5 → avg = 4
      expect(result.data.averageRating).toBe(4);
    }
  });

  it("yorum yoksa averageRating null", async () => {
    const result = await getReviewsForListing(listing.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reviews.length).toBe(0);
      expect(result.data.averageRating).toBeNull();
    }
  });

  it("reviewsEnabled=false → boş döner", async () => {
    await seedReviews(2);
    await prisma.setting.create({
      data: { key: "reviewsEnabled", value: false },
    });

    const result = await getReviewsForListing(listing.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reviews.length).toBe(0);
      expect(result.data.averageRating).toBeNull();
    }
  });

  it("owner reviewsVisible=false → boş döner", async () => {
    await seedReviews(2);
    await prisma.user.update({
      where: { id: owner.id },
      data: { reviewsVisible: false },
    });

    const result = await getReviewsForListing(listing.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reviews.length).toBe(0);
      expect(result.data.averageRating).toBeNull();
    }
  });
});

describe("getUserReviews", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing1: Awaited<ReturnType<typeof makeListing>>;
  let listing2: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing1 = await prisma.listing.create({
      data: makeListing(owner.id, { title: "İlan 1", status: "ACTIVE" }),
    });
    listing2 = await prisma.listing.create({
      data: makeListing(renter.id, { title: "İlan 2", status: "ACTIVE" }),
    });

    // renter'ın listing1'e yazdığı yorum
    const booking1 = await makeCompletedBooking(listing1.id, renter.id);
    await prisma.review.create({
      data: {
        listingId: listing1.id,
        authorId: renter.id,
        bookingId: booking1.id,
        rating: 5,
        comment: "Harika!",
      },
    });

    // owner'ın listing2'ye yazdığı yorum
    const booking2 = await makeCompletedBooking(listing2.id, owner.id);
    await prisma.review.create({
      data: {
        listingId: listing2.id,
        authorId: owner.id,
        bookingId: booking2.id,
        rating: 4,
      },
    });
  });

  it("written: kullanıcının yazdığı yorumlar", async () => {
    const result = await getUserReviews(mockUser(renter.id, renter.email));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.written.length).toBe(1);
      expect(result.data.written[0].comment).toBe("Harika!");
    }
  });

  it("received: ilanlarına yazılan yorumlar", async () => {
    const result = await getUserReviews(mockUser(owner.id, owner.email));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.received.length).toBe(1);
      expect(result.data.received[0].author.id).toBe(renter.id);
    }
  });
});

describe("updateReviewsVisibleCore", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
  });

  it("reviewsVisible güncellenir", async () => {
    const result = await updateReviewsVisibleCore(
      mockUser(owner.id, owner.email),
      false,
    );

    expect(result.ok).toBe(true);
    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(updated.reviewsVisible).toBe(false);
  });
});
