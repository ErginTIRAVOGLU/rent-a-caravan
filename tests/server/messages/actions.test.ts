import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// Hoisted auth mock
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

// Mock next-auth before it's imported by auth.ts
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

import {
  startConversation,
  sendMessage,
  markMessagesRead,
  getConversations,
  getConversation,
} from "../../../src/server/messages/actions";

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("startConversation action", () => {
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

  it("oturumlu kullanıcı için sohbet başlatır", async () => {
    sessionFor(renter);

    const result = await startConversation(listing.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.renterId).toBe(renter.id);
      expect(result.data.ownerId).toBe(owner.id);
    }
  });

  it("oturum yoksa redirect atar (requireUser)", async () => {
    authMock.mockResolvedValue(null);

    // redirect throw ettiği için action da throw etmelidir
    await expect(startConversation(listing.id)).rejects.toThrow();
  });
});

describe("sendMessage action", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let conversationId: string;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    const conv = await prisma.conversation.create({
      data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
    });
    conversationId = conv.id;
  });

  it("oturumlu kullanıcı mesaj gönderir", async () => {
    sessionFor(renter);

    const result = await sendMessage(conversationId, "Test mesajı");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.content).toBe("Test mesajı");
      expect(result.data.senderId).toBe(renter.id);
    }
  });

  it("oturum yoksa redirect atar", async () => {
    authMock.mockResolvedValue(null);

    await expect(sendMessage(conversationId, "Test")).rejects.toThrow();
  });
});

describe("markMessagesRead action", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let conversationId: string;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    const conv = await prisma.conversation.create({
      data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
    });
    conversationId = conv.id;

    await prisma.message.createMany({
      data: [
        { conversationId, senderId: renter.id, content: "M1" },
        { conversationId, senderId: renter.id, content: "M2" },
      ],
    });
  });

  it("oturumlu kullanıcı mesajları okundu işaretler", async () => {
    sessionFor(owner);

    const result = await markMessagesRead(conversationId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(2);
    }
  });

  it("oturum yoksa redirect atar", async () => {
    authMock.mockResolvedValue(null);

    await expect(markMessagesRead(conversationId)).rejects.toThrow();
  });
});

describe("getConversations action", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({ data: makeListing(owner.id, { status: "ACTIVE" }) });

    await prisma.conversation.create({
      data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
    });
  });

  it("oturumlu kullanıcının sohbet listesini döndürür", async () => {
    sessionFor(renter);

    const result = await getConversations();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBe(1);
      expect(result.data[0].renterId).toBe(renter.id);
    }
  });

  it("oturum yoksa redirect atar", async () => {
    authMock.mockResolvedValue(null);

    await expect(getConversations()).rejects.toThrow();
  });
});

describe("getConversation action", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let conversationId: string;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({ data: makeListing(owner.id, { status: "ACTIVE" }) });
    const conv = await prisma.conversation.create({
      data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
    });
    conversationId = conv.id;
  });

  it("oturumlu kullanıcı sohbet detayını alır", async () => {
    sessionFor(renter);

    const result = await getConversation(conversationId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(conversationId);
    }
  });

  it("oturum yoksa redirect atar", async () => {
    authMock.mockResolvedValue(null);

    await expect(getConversation(conversationId)).rejects.toThrow();
  });
});
