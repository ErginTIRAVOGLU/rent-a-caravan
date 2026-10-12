import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../src/lib/prisma";
import {
  getAccountCounts,
  getAdminCounts,
} from "../../src/server/panel/counts";
import { makeListing, makeUser, resetDb } from "../helpers/db";

// Panel sayaç çekirdeği — HTTP/oturum yok: `userId` açık parametre.
//
// Odak (spec §7.5 + §8): layout'ların rol bazlı menü rozetleri için yalnız
// `count` sorguları. Okunmamış mesaj kuralı mevcut `/api/messages/unread-count`
// ucu ile BİREBİR aynıdır (sender ≠ kullanıcı, readAt=null, kullanıcının
// katıldığı sohbet) — sidebar rozeti ile topbar SWR rozeti asla ayrışmaz.

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

beforeEach(async () => {
  await resetDb();
});

describe("getAccountCounts", () => {
  it("listings/pendingIncoming/unreadMessages sayılarını doğru döner", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({ data: makeUser() });
    const other = await prisma.user.create({ data: makeUser() });

    // Sahibin iki ilanı; başkasının ilanı sayılmaz.
    await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    const pendingListing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "DRAFT" }),
    });
    const otherListing = await prisma.listing.create({
      data: makeListing(other.id, { status: "ACTIVE" }),
    });

    // Bekleyen GELEN talep: sahibin ilanına PENDING.
    await prisma.bookingRequest.create({
      data: {
        listingId: pendingListing.id,
        renterId: renter.id,
        startDate: utcDate("2030-06-10"),
        endDate: utcDate("2030-06-14"),
        guests: 2,
        totalPrice: 6000,
        status: "PENDING",
      },
    });
    // APPROVED talep sayılmaz.
    await prisma.bookingRequest.create({
      data: {
        listingId: pendingListing.id,
        renterId: renter.id,
        startDate: utcDate("2030-07-10"),
        endDate: utcDate("2030-07-14"),
        guests: 2,
        totalPrice: 6000,
        status: "APPROVED",
      },
    });
    // Başka sahibin ilanına PENDING talep sayılmaz.
    await prisma.bookingRequest.create({
      data: {
        listingId: otherListing.id,
        renterId: renter.id,
        startDate: utcDate("2030-08-10"),
        endDate: utcDate("2030-08-14"),
        guests: 2,
        totalPrice: 6000,
        status: "PENDING",
      },
    });

    // Okunmamış: karşı tarafın gönderdiği, readAt=null mesaj.
    const conversation = await prisma.conversation.create({
      data: {
        listingId: pendingListing.id,
        renterId: renter.id,
        ownerId: owner.id,
      },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: renter.id,
        content: "Müsait mi?",
      },
    });
    // Okunmuş mesaj sayılmaz.
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: renter.id,
        content: "Okunmuş",
        readAt: new Date(),
      },
    });
    // Kendi gönderdiği mesaj (okunmamış olsa da) sayılmaz.
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: owner.id,
        content: "Kendi mesajım",
      },
    });
    // Dahil olmadığı sohbetteki mesaj sayılmaz.
    const strangerConversation = await prisma.conversation.create({
      data: {
        listingId: otherListing.id,
        renterId: other.id,
        ownerId: other.id,
      },
    });
    await prisma.message.create({
      data: {
        conversationId: strangerConversation.id,
        senderId: other.id,
        content: "Beni ilgilendirmez",
      },
    });

    const counts = await getAccountCounts(owner.id);

    expect(counts).toEqual({
      listings: 2,
      pendingIncoming: 1,
      unreadMessages: 1,
    });
  });

  it("kayıt yoksa tüm sayaçlar 0 döner", async () => {
    const user = await prisma.user.create({ data: makeUser() });

    expect(await getAccountCounts(user.id)).toEqual({
      listings: 0,
      pendingIncoming: 0,
      unreadMessages: 0,
    });
  });
});

describe("getAdminCounts", () => {
  it("pendingListings ve openReports sayılarını doğru döner", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const reporter = await prisma.user.create({ data: makeUser() });

    // Yalnız PENDING ilan sayılır.
    await prisma.listing.create({
      data: makeListing(owner.id, { status: "PENDING" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { status: "DRAFT" }),
    });

    // Yalnız OPEN şikâyet sayılır.
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: owner.id,
        reason: "Açık şikâyet",
        status: "OPEN",
      },
    });
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "USER",
        targetId: owner.id,
        reason: "İncelenen şikâyet",
        status: "REVIEWING",
      },
    });
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "USER",
        targetId: owner.id,
        reason: "Kapanmış şikâyet",
        status: "CLOSED",
      },
    });

    expect(await getAdminCounts()).toEqual({
      pendingListings: 1,
      openReports: 1,
    });
  });

  it("kayıt yoksa tüm sayaçlar 0 döner", async () => {
    expect(await getAdminCounts()).toEqual({
      pendingListings: 0,
      openReports: 0,
    });
  });
});
