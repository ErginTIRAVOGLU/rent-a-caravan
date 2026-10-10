import type { Conversation, Message, Listing, User } from "@prisma/client";
import type { ZodError } from "zod";

import { prisma } from "../../lib/prisma";
import { fail, firstIssue, ok, type ActionResult } from "../../lib/result";
import { sendMessageSchema } from "../../lib/validators/message";
import { assertRateLimit, MESSAGE_LIMIT } from "../../lib/rate-limit";
import type { SessionUser } from "../users/service";

const YETKI_YOK = "Bu sohbete mesaj gönderme yetkiniz yok.";
const SOHBET_BULUNAMADI = "Sohbet bulunamadı.";
const KENDI_ILANINIZ = "Kendi ilanınıza mesaj gönderemezsiniz.";
const GECERSIZ_ILAN_ID = "Geçersiz ilan kimliği.";
const GECERSIZ_SOHBET_ID = "Geçersiz sohbet kimliği.";

const CUID_RE = /^c[a-z0-9]{24}$/;

function invalidListingId(id: string): ActionResult<never> | null {
  return CUID_RE.test(id) ? null : fail(GECERSIZ_ILAN_ID);
}

function invalidConversationId(id: string): ActionResult<never> | null {
  return CUID_RE.test(id) ? null : fail(GECERSIZ_SOHBET_ID);
}

function validationFail<T>(error: ZodError): ActionResult<T> {
  const issue = firstIssue(error);
  return fail(issue.message, issue.field);
}

export type ConversationWithDetails = Conversation & {
  listing: Pick<Listing, "id" | "title" | "photoUrls" | "status">;
  renter: Pick<User, "id" | "name" | "avatarUrl">;
  owner: Pick<User, "id" | "name" | "avatarUrl">;
  _count: { messages: number };
  unreadCount: number;
};

export type ConversationThread = Conversation & {
  listing: Pick<Listing, "id" | "title" | "photoUrls" | "status">;
  renter: Pick<User, "id" | "name" | "avatarUrl">;
  owner: Pick<User, "id" | "name" | "avatarUrl">;
  messages: (Message & { sender: Pick<User, "id" | "name" | "avatarUrl"> })[];
  bookingStatus: string | null;
};

/**
 * Sohbet başlat veya var olanı getir — benzersiz kısıt (listingId, renterId) ile
 * yarış durumunu P2002 hata kodu ile yönetir.
 */
export async function startConversationCore(
  user: SessionUser,
  listingId: string,
): Promise<ActionResult<ConversationWithDetails>> {
  const badId = invalidListingId(listingId);
  if (badId) {
    return badId;
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, ownerId: true, title: true, photoUrls: true, status: true },
  });
  if (!listing) {
    return fail("İlan bulunamadı.");
  }
  if (listing.ownerId === user.id) {
    return fail(KENDI_ILANINIZ);
  }

  try {
    const conversation = await prisma.conversation.create({
      data: {
        listingId,
        renterId: user.id,
        ownerId: listing.ownerId,
      },
      include: {
        listing: { select: { id: true, title: true, photoUrls: true, status: true } },
        renter: { select: { id: true, name: true, avatarUrl: true } },
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { messages: true } },
      },
    });
    return ok({
      ...conversation,
      unreadCount: 0,
    });
  } catch (error: unknown) {
    // P2002: Unique constraint violation on (listingId, renterId)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.conversation.findUnique({
        where: {
          listingId_renterId: { listingId, renterId: user.id },
        },
        include: {
          listing: { select: { id: true, title: true, photoUrls: true, status: true } },
          renter: { select: { id: true, name: true, avatarUrl: true } },
          owner: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { messages: true } },
        },
      });
      if (existing) {
        return ok({
          ...existing,
          unreadCount: 0,
        });
      }
    }
    throw error;
  }
}

/**
 * Mesaj gönder — üyelik doğrulama, Zod 1..2000, rate-limit, lastMessageAt/Preview güncelle.
 */
export async function sendMessageCore(
  user: SessionUser,
  conversationId: string,
  content: string,
): Promise<ActionResult<Message>> {
  const badId = invalidConversationId(conversationId);
  if (badId) {
    return badId;
  }

  const parsed = sendMessageSchema.safeParse({ content });
  if (!parsed.success) {
    return validationFail(parsed.error);
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, renterId: true, ownerId: true },
  });
  if (!conversation) {
    return fail(SOHBET_BULUNAMADI);
  }
  const isMember =
    conversation.renterId === user.id || conversation.ownerId === user.id;
  if (!isMember) {
    return fail(YETKI_YOK);
  }

  const rateLimitResult = await assertRateLimit(
    "message",
    user.id,
    MESSAGE_LIMIT.limit,
    MESSAGE_LIMIT.windowSeconds,
  );
  if (!rateLimitResult.ok) {
    return rateLimitResult;
  }

  const message = await prisma.$transaction(async (tx) => {
    const newMessage = await tx.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: parsed.data.content,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: newMessage.createdAt,
        lastMessagePreview: parsed.data.content.slice(0, 120),
      },
    });

    return newMessage;
  });

  return ok(message);
}

/**
 * Mesajları okundu olarak işaretle — diğer tarafın gönderdiği, henüz okunmamış mesajlar.
 */
export async function markMessagesReadCore(
  user: SessionUser,
  conversationId: string,
): Promise<ActionResult<number>> {
  const badId = invalidConversationId(conversationId);
  if (badId) {
    return badId;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, renterId: true, ownerId: true },
  });
  if (!conversation) {
    return fail(SOHBET_BULUNAMADI);
  }
  const isMember =
    conversation.renterId === user.id || conversation.ownerId === user.id;
  if (!isMember) {
    return fail(YETKI_YOK);
  }

  const result = await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: user.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return ok(result.count);
}

/**
 * Kullanıcının sohbet listesi — renter veya owner olduğu sohbetler, lastMessageAt desc.
 * Unread count = diğer tarafın gönderdiği, readAt=null mesaj sayısı.
 */
export async function getConversationsCore(
  user: SessionUser,
): Promise<ActionResult<ConversationWithDetails[]>> {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ renterId: user.id }, { ownerId: user.id }],
    },
    include: {
      listing: { select: { id: true, title: true, photoUrls: true, status: true } },
      renter: { select: { id: true, name: true, avatarUrl: true } },
      owner: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  // Her sohbet için okunmamış sayısını hesapla
  const conversationIds = conversations.map((c) => c.id);
  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversationIds },
      senderId: { not: user.id },
      readAt: null,
    },
    _count: { id: true },
  });
  const unreadMap = new Map(
    unreadCounts.map((u) => [u.conversationId, u._count.id]),
  );

  const result = conversations.map((c) => ({
    ...c,
    unreadCount: unreadMap.get(c.id) ?? 0,
  }));

  return ok(result);
}

/**
 * Sohbet detayı — üyelik doğrulama, mesajlar + listing bilgisi + booking durumu.
 */
export async function getConversationCore(
  user: SessionUser,
  conversationId: string,
): Promise<ActionResult<ConversationThread>> {
  const badId = invalidConversationId(conversationId);
  if (badId) {
    return badId;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { id: true, title: true, photoUrls: true, status: true } },
      renter: { select: { id: true, name: true, avatarUrl: true } },
      owner: { select: { id: true, name: true, avatarUrl: true } },
      messages: {
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    return fail(SOHBET_BULUNAMADI);
  }
  const isMember =
    conversation.renterId === user.id || conversation.ownerId === user.id;
  if (!isMember) {
    return fail(YETKI_YOK);
  }

  // Booking durumu: bu listing + renter için aktif/pending booking var mı?
  const booking = await prisma.bookingRequest.findFirst({
    where: {
      listingId: conversation.listingId,
      renterId: conversation.renterId,
      status: { in: ["PENDING", "APPROVED", "COMPLETED"] },
    },
    select: { status: true },
    orderBy: { createdAt: "desc" },
  });

  return ok({
    ...conversation,
    bookingStatus: booking?.status ?? null,
  });
}
