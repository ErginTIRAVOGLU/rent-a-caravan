import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../../../../src/lib/prisma";
import { makeListing, makeUser, resetDb } from "../../../../helpers/db";

// Hoisted auth mock (mesajlar page testiyle aynı desen: @/lib/auth,
// NextAuth fabrika mock'undan beslenir).
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

import { GET } from "../../../../../src/app/api/messages/unread-count/route";

function setupSession(user: { id: string; isBanned?: boolean }) {
  authMock.mockResolvedValue({
    user: {
      id: user.id,
      name: "Test",
      email: "test@karavan.test",
      role: "USER",
      isBanned: user.isBanned ?? false,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("GET /api/messages/unread-count", () => {
  it("oturum yoksa 401 döner", async () => {
    authMock.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ count: 0 });
  });

  it("karşı tarafın 1 okunmamış mesajını { count: 1 } sayar", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({ data: makeUser() });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id),
    });
    const conversation = await prisma.conversation.create({
      data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: owner.id,
        content: "Merhaba, ilan müsait mi?",
      },
    });
    setupSession(renter);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ count: 1 });
  });

  it("başka kullanıcıların mesajlarını saymaz", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({ data: makeUser() });
    const outsider = await prisma.user.create({ data: makeUser() });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id),
    });
    // Oturum kullanıcısının dahil olmadığı sohbetteki mesaj.
    const otherListing = await prisma.listing.create({
      data: makeListing(owner.id),
    });
    const otherConversation = await prisma.conversation.create({
      data: {
        listingId: otherListing.id,
        renterId: outsider.id,
        ownerId: owner.id,
      },
    });
    await prisma.message.create({
      data: {
        conversationId: otherConversation.id,
        senderId: outsider.id,
        content: "Beni ilgilendirmez",
      },
    });
    // Kendi gönderdiği (okunmamış olsa da) mesaj.
    const ownConversation = await prisma.conversation.create({
      data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
    });
    await prisma.message.create({
      data: {
        conversationId: ownConversation.id,
        senderId: renter.id,
        content: "Kendi mesajım",
      },
    });
    // Okunmuş mesaj.
    await prisma.message.create({
      data: {
        conversationId: ownConversation.id,
        senderId: owner.id,
        content: "Okunmuş mesaj",
        readAt: new Date(),
      },
    });
    setupSession(renter);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ count: 0 });
  });

  it("birden çok sohbetteki okunmamışları toplar", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const renter = await prisma.user.create({ data: makeUser() });
    for (let i = 0; i < 2; i += 1) {
      const listing = await prisma.listing.create({
        data: makeListing(owner.id),
      });
      const conversation = await prisma.conversation.create({
        data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
      });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: owner.id,
          content: `Mesaj ${i}`,
        },
      });
    }
    setupSession(renter);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ count: 2 });
  });
});
