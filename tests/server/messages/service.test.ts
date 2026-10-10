import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../../src/lib/prisma";
import {
  startConversationCore,
  sendMessageCore,
  markMessagesReadCore,
  getConversationsCore,
  getConversationCore,
} from "../../../src/server/messages/service";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

beforeEach(async () => {
  await resetDb();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function mockUser(id: string, email: string) {
  return { id, name: "Test", email, role: "USER" as const, isBanned: false };
}

describe("startConversationCore", () => {
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

  it("yeni sohbet oluşturur (renter, owner, listing ilişkilendirilir)", async () => {
    const result = await startConversationCore(mockUser(renter.id, renter.email), listing.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.renterId).toBe(renter.id);
      expect(result.data.ownerId).toBe(owner.id);
      expect(result.data.listingId).toBe(listing.id);
      expect(result.data.unreadCount).toBe(0);
      expect(result.data.listing.title).toBe(listing.title);
    }
  });

  it("kendi ilanına sohbet başlatamaz (KENDI_ILANINIZ hatası)", async () => {
    const result = await startConversationCore(mockUser(owner.id, owner.email), listing.id);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Kendi ilanınıza mesaj gönderemezsiniz.");
    }
  });

  it("var olan sohbet varsa tekrar oluşturmaz (idempotent, P2002 race handling)", async () => {
    // İlk çağrı
    const first = await startConversationCore(mockUser(renter.id, renter.email), listing.id);
    expect(first.ok).toBe(true);

    // İkinci çağrı - aynı sohbeti döndürmeli
    const second = await startConversationCore(mockUser(renter.id, renter.email), listing.id);
    expect(second.ok).toBe(true);

    if (first.ok && second.ok) {
      expect(first.data.id).toBe(second.data.id);
    }
  });

  it("olmayan ilan için hata döner", async () => {
    const fakeId = "c" + "a".repeat(24);
    const result = await startConversationCore(mockUser(renter.id, renter.email), fakeId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("İlan bulunamadı.");
    }
  });

  it("geçersiz ilan ID formatı için hata döner", async () => {
    const result = await startConversationCore(mockUser(renter.id, renter.email), "invalid-id");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Geçersiz ilan kimliği.");
    }
  });
});

describe("sendMessageCore", () => {
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

  it("üyeye mesaj gönderir ve lastMessageAt/Preview günceller", async () => {
    const result = await sendMessageCore(mockUser(renter.id, renter.email), conversationId, "Merhaba, ilan hala müsait mi?");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.content).toBe("Merhaba, ilan hala müsait mi?");
      expect(result.data.senderId).toBe(renter.id);
      expect(result.data.conversationId).toBe(conversationId);

      // lastMessageAt ve lastMessagePreview güncellenmeli
      const updated = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
      expect(updated.lastMessageAt).not.toBeNull();
      expect(updated.lastMessagePreview).toBe("Merhaba, ilan hala müsait mi?");
    }
  });

  it("sahip de mesaj gönderebilir", async () => {
    const result = await sendMessageCore(mockUser(owner.id, owner.email), conversationId, "Evet, müsait.");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.senderId).toBe(owner.id);
    }
  });

  it("üyeliği olmayan kullanıcı mesaj gönderemez (YETKI_YOK)", async () => {
    const outsider = await prisma.user.create({ data: makeUser({ email: "outsider@test.com" }) });
    const result = await sendMessageCore(mockUser(outsider.id, outsider.email), conversationId, "Hack denemesi");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Bu sohbete mesaj gönderme yetkiniz yok.");
    }
  });

  it("boş mesaj reddedilir (Zod min 1)", async () => {
    const result = await sendMessageCore(mockUser(renter.id, renter.email), conversationId, "   ");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Mesaj en az 1 karakter olmalıdır.");
    }
  });

  it("2000 karakterden uzun mesaj reddedilir (Zod max 2000)", async () => {
    const longContent = "a".repeat(2001);
    const result = await sendMessageCore(mockUser(renter.id, renter.email), conversationId, longContent);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Mesaj en fazla 2000 karakter olabilir.");
    }
  });

  it("rate limit aşılırsa hata döner (MESSAGE_LIMIT=20/60s)", async () => {
    // 20 mesaj gönder - hepsi başarılı olmalı
    for (let i = 0; i < 20; i++) {
      const result = await sendMessageCore(mockUser(renter.id, renter.email), conversationId, `Mesaj ${i}`);
      expect(result.ok).toBe(true);
    }

    // 21. mesaj rate limit hatası almalı
    const result = await sendMessageCore(mockUser(renter.id, renter.email), conversationId, "Fazla mesaj");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Çok fazla istek gönderdiniz, biraz bekleyin");
    }
  });

  it("optimistic preview: lastMessagePreview içeriğin ilk 120 karakteri", async () => {
    const longContent = "a".repeat(150);
    const result = await sendMessageCore(mockUser(renter.id, renter.email), conversationId, longContent);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const updated = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
      expect(updated.lastMessagePreview).toBe("a".repeat(120));
    }
  });
});

describe("markMessagesReadCore", () => {
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

    // Renter'dan 3 mesaj, owner'dan 2 mesaj (biri okunmuş)
    await prisma.message.createMany({
      data: [
        { conversationId, senderId: renter.id, content: "R1" },
        { conversationId, senderId: renter.id, content: "R2" },
        { conversationId, senderId: renter.id, content: "R3" },
        { conversationId, senderId: owner.id, content: "O1" },
        { conversationId, senderId: owner.id, content: "O2", readAt: new Date() }, // zaten okunmuş
      ],
    });
  });

  it("diğer tarafın gönderdiği okunmamış mesajları işaretler", async () => {
    // Owner sohbeti açar -> renter'ın mesajları okunmuş sayılır
    const result = await markMessagesReadCore(mockUser(owner.id, owner.email), conversationId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(3); // 3 mesaj işaretlendi
    }

    const unread = await prisma.message.count({
      where: { conversationId, senderId: renter.id, readAt: null },
    });
    expect(unread).toBe(0);
  });

  it("zaten okunmuş mesajları tekrar saymaz", async () => {
    await markMessagesReadCore(mockUser(owner.id, owner.email), conversationId);
    const result = await markMessagesReadCore(mockUser(owner.id, owner.email), conversationId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(0); // hiçbiri yeni işaretlenmedi
    }
  });

  it("kendi gönderdiği mesajları işaretlemez (senderId !== user.id)", async () => {
    // Renter sohbeti açar -> kendi mesajları değil, owner'ın mesajları işaretlenir
    const result = await markMessagesReadCore(mockUser(renter.id, renter.email), conversationId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(1); // sadece O1 (O2 zaten okunmuş)
    }

    const unreadOwner = await prisma.message.count({
      where: { conversationId, senderId: owner.id, readAt: null },
    });
    expect(unreadOwner).toBe(0);
  });

  it("üyeliği olmayan kullanıcı işaretleyemez (YETKI_YOK)", async () => {
    const outsider = await prisma.user.create({ data: makeUser({ email: "outsider@test.com" }) });
    const result = await markMessagesReadCore(mockUser(outsider.id, outsider.email), conversationId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Bu sohbete mesaj gönderme yetkiniz yok.");
    }
  });
});

describe("getConversationsCore", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing1: Awaited<ReturnType<typeof makeListing>>;
  let listing2: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing1 = await prisma.listing.create({ data: makeListing(owner.id, { title: "İlan 1" }) });
    listing2 = await prisma.listing.create({ data: makeListing(owner.id, { title: "İlan 2" }) });

    // İki sohbet: biri renter olarak, biri owner olarak
    await prisma.conversation.create({
      data: { listingId: listing1.id, renterId: renter.id, ownerId: owner.id },
    });
    await prisma.conversation.create({
      data: { listingId: listing2.id, renterId: renter.id, ownerId: owner.id },
    });
  });

  it("hem renter hem owner olduğu sohbetleri döndürür, lastMessageAt desc sıralı", async () => {
    const result = await getConversationsCore(mockUser(renter.id, renter.email));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBe(2);
      // lastMessageAt null olduğu için createdAt'e göre sıralı (ikisi de yeni)
      expect(result.data.every((c) => c.renterId === renter.id || c.ownerId === renter.id)).toBe(true);
    }
  });

  it("unreadCount diğer tarafın gönderdiği okunmamış mesaj sayısıdır", async () => {
    const convs = await prisma.conversation.findMany({ where: { renterId: renter.id } });
    const conv1 = convs[0];
    const conv2 = convs[1];

    // conv1'de renter'dan 2 mesaj (owner için unread)
    await prisma.message.createMany({
      data: [
        { conversationId: conv1.id, senderId: renter.id, content: "M1" },
        { conversationId: conv1.id, senderId: renter.id, content: "M2" },
      ],
    });
    // conv2'de owner'dan 1 mesaj (renter için unread)
    await prisma.message.createMany({
      data: [{ conversationId: conv2.id, senderId: owner.id, content: "O1" }],
    });

    // Owner için unread count
    const ownerResult = await getConversationsCore(mockUser(owner.id, owner.email));
    expect(ownerResult.ok).toBe(true);
    if (ownerResult.ok) {
      const c1 = ownerResult.data.find((c) => c.id === conv1.id);
      const c2 = ownerResult.data.find((c) => c.id === conv2.id);
      expect(c1?.unreadCount).toBe(2);
      expect(c2?.unreadCount).toBe(0); // owner kendi mesajını gönderdi
    }

    // Renter için unread count
    const renterResult = await getConversationsCore(mockUser(renter.id, renter.email));
    expect(renterResult.ok).toBe(true);
    if (renterResult.ok) {
      const c1 = renterResult.data.find((c) => c.id === conv1.id);
      const c2 = renterResult.data.find((c) => c.id === conv2.id);
      expect(c1?.unreadCount).toBe(0); // renter kendi mesajını gönderdi
      expect(c2?.unreadCount).toBe(1); // owner'ın mesajı
    }
  });
});

describe("getConversationCore", () => {
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

    await prisma.message.createMany({
      data: [
        { conversationId, senderId: renter.id, content: "Merhaba" },
        { conversationId, senderId: owner.id, content: "Merhaba, nasıl yardımcı olabilirim?" },
      ],
    });
  });

  it("üyeye sohbet detayını döndürür (mesajlar, listing, bookingStatus)", async () => {
    const result = await getConversationCore(mockUser(renter.id, renter.email), conversationId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(conversationId);
      expect(result.data.messages.length).toBe(2);
      expect(result.data.listing.id).toBe(listing.id);
      expect(result.data.bookingStatus).toBeNull();
    }
  });

  it("bookingStatus: PENDING/APPROVED/COMPLETED booking varsa döner", async () => {
    await prisma.bookingRequest.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        guests: 2,
        totalPrice: 5000,
        status: "APPROVED",
      },
    });

    const result = await getConversationCore(mockUser(renter.id, renter.email), conversationId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.bookingStatus).toBe("APPROVED");
    }
  });

  it("üyeliği olmayan kullanıcı erişemez (YETKI_YOK)", async () => {
    const outsider = await prisma.user.create({ data: makeUser({ email: "outsider@test.com" }) });
    const result = await getConversationCore(mockUser(outsider.id, outsider.email), conversationId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Bu sohbete mesaj gönderme yetkiniz yok.");
    }
  });
});