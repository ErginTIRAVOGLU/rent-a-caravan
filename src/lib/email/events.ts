import { resendClient } from "./client";
import type { EmailClient } from "./client";
import {
  bookingRequestedTemplate,
  bookingStatusChangedTemplate,
  DIGEST_MAX_CONVERSATIONS,
  dailyDigestTemplate,
  listingStatusChangedTemplate,
  registerVerifyTemplate,
} from "./templates";
import type {
  BookingRequestedData,
  BookingStatusChangedData,
  ListingStatusChangedData,
} from "./templates";
import { prisma } from "../prisma";

// E-posta olayları — spec: "gönderim hatası asla ana akışı düşürmez".
// Her fonksiyon try/catch ile sarılır: hata console.error ile loglanır,
// Promise asla reject olmaz. client parametresi test enjeksiyonu içindir.
// (Tek fark: sendDailyDigest — DB'den kullanıcı listesini kendisi bulur ve
// gönderilen mail sayısını döner; cron route bunu `{ sent: n }` olarak yayınlar.)

export async function sendBookingRequested(
  to: string,
  data: BookingRequestedData,
  client: EmailClient = resendClient,
): Promise<void> {
  try {
    await client.send(bookingRequestedTemplate(to, data));
  } catch (error) {
    console.error("[email] sendBookingRequested gönderimi başarısız:", error);
  }
}

export async function sendBookingStatusChanged(
  to: string,
  data: BookingStatusChangedData,
  client: EmailClient = resendClient,
): Promise<void> {
  try {
    await client.send(bookingStatusChangedTemplate(to, data));
  } catch (error) {
    console.error("[email] sendBookingStatusChanged gönderimi başarısız:", error);
  }
}

export async function sendListingStatusChanged(
  to: string,
  data: ListingStatusChangedData,
  client: EmailClient = resendClient,
): Promise<void> {
  try {
    await client.send(listingStatusChangedTemplate(to, data));
  } catch (error) {
    console.error("[email] sendListingStatusChanged gönderimi başarısız:", error);
  }
}

/**
 * Kayıt sonrası e-posta doğrulama linki gönderir.
 * Hata ana akışı düşürmez (try/catch ile sarılır).
 */
export async function sendRegisterVerify(
  to: string,
  token: string,
  client: EmailClient = resendClient,
): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const verifyUrl = `${baseUrl}/dogrula?token=${token}`;
    await client.send(registerVerifyTemplate(to, { verifyUrl, expiryHours: 24 }));
  } catch (error) {
    console.error("[email] sendRegisterVerify gönderimi başarısız:", error);
  }
}

// ---------------------------------------------------------------------------
// Günlük mesaj özeti (T9)
// ---------------------------------------------------------------------------

/** Özet penceresi: yalnız son kaç günün okunmamış mesajları alınır. */
const DIGEST_WINDOW_DAYS = 7;

interface DigestRecipient {
  id: string;
  name: string;
  email: string;
}

interface DigestConversationRow {
  id: string;
  listingTitle: string;
  preview: string;
  unreadCount: number;
  /** Sohbetteki en son okunmamış mesajın zamanı (sıralama + önizleme için). */
  lastUnreadAt: Date;
}

interface DigestEntry {
  recipient: DigestRecipient;
  conversations: DigestConversationRow[];
}

/** (sohbet, gönderen) → okunmamış sayı + en son mesajın zamanı ve içeriği. */
interface UnreadGroup {
  count: number;
  lastUnreadAt: Date;
  preview: string;
}

/**
 * Okunmamış sohbetleri kullanıcı bazında toplar.
 *
 * Sınırlar: iki ayrı sorgu ile sohbet başına okunmamış SAYISI (groupBy) ve
 * en son okunmamış ÖNİZLEME (distinct + orderBy) alınır — ikisi de satır
 * sayısı sohbet sayısıyla sınırlıdır, mesaj geçmişi büyüdükçe büyümez.
 */
async function collectDigests(since: Date): Promise<DigestEntry[]> {
  const conversations = await prisma.conversation.findMany({
    // Pencere içinde okunmamış mesajı olan sohbetler (alıcı ayrımı JS'te).
    where: { messages: { some: { readAt: null, createdAt: { gte: since } } } },
    select: {
      id: true,
      listing: { select: { title: true } },
      renter: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  if (conversations.length === 0) {
    return [];
  }
  const conversationIds = conversations.map((c) => c.id);

  // (sohbet, gönderen) bazında okunmamış sayısı — alıcı kendisi hariç
  // tutulur; böylece aynı sohbet iki farklı kullanıcı için ayrı sayılır.
  const countGroups = await prisma.message.groupBy({
    by: ["conversationId", "senderId"],
    where: {
      conversationId: { in: conversationIds },
      readAt: null,
      createdAt: { gte: since },
    },
    _count: { id: true },
  });
  // (sohbet, gönderen) bazında en son okunmamış mesaj (önizleme) —
  // `distinct` satır sayısını sohbet × gönderen ile sınırlar.
  const latestMessages = await prisma.message.findMany({
    where: {
      conversationId: { in: conversationIds },
      readAt: null,
      createdAt: { gte: since },
    },
    distinct: ["conversationId", "senderId"],
    orderBy: { createdAt: "desc" },
    select: {
      conversationId: true,
      senderId: true,
      content: true,
      createdAt: true,
    },
  });

  const unread = new Map<string, Map<string, UnreadGroup>>();
  for (const group of countGroups) {
    const bySender = unread.get(group.conversationId) ?? new Map<string, UnreadGroup>();
    bySender.set(group.senderId, {
      count: group._count.id,
      lastUnreadAt: new Date(0),
      preview: "",
    });
    unread.set(group.conversationId, bySender);
  }
  for (const message of latestMessages) {
    const bySender = unread.get(message.conversationId);
    const entry = bySender?.get(message.senderId);
    if (!entry) {
      continue; // sayaçta yok: tutarsız an, atla
    }
    entry.preview = message.content;
    entry.lastUnreadAt = message.createdAt;
  }

  const perUser = new Map<string, DigestEntry>();
  for (const conversation of conversations) {
    const bySender = unread.get(conversation.id);
    if (!bySender) {
      continue;
    }
    // Bir sohbetin iki tarafı da alıcı olabilir (kiracı ve sahip).
    for (const recipient of [conversation.renter, conversation.owner]) {
      let unreadCount = 0;
      let latest: UnreadGroup | null = null;
      for (const [senderId, group] of bySender) {
        if (senderId === recipient.id) {
          continue; // kendi gönderdiği mesaj okunmamış sayılmaz
        }
        unreadCount += group.count;
        if (!latest || group.lastUnreadAt > latest.lastUnreadAt) {
          latest = group;
        }
      }
      if (unreadCount === 0 || !latest) {
        continue;
      }
      const entry = perUser.get(recipient.id) ?? {
        recipient,
        conversations: [],
      };
      entry.conversations.push({
        id: conversation.id,
        listingTitle: conversation.listing.title,
        preview: latest.preview,
        unreadCount,
        lastUnreadAt: latest.lastUnreadAt,
      });
      perUser.set(recipient.id, entry);
    }
  }

  for (const entry of perUser.values()) {
    // En yeni okunmamış mesaja göre azalan; e-postada en fazla 5 sohbet.
    entry.conversations.sort(
      (a, b) => b.lastUnreadAt.getTime() - a.lastUnreadAt.getTime(),
    );
  }
  return [...perUser.values()];
}

/**
 * Günlük mesaj özeti (T9): okunmamış mesajı olan her kullanıcıya TEK e-posta —
 * içinde en fazla 5 sohbet (önizleme + okunmamış sayı + "Mesajları gör").
 *
 * Diğer e-posta fonksiyonlarından farkı: kullanıcı listesini DB'den kendisi
 * bulur ve gönderilen mail sayısını döner (cron route bunu `{ sent: n }` olarak
 * yayınlar). Sözleşmesi aynı: hata ASLA yukarı sızmaz — sorgu hatası 0 döner,
 * tek kullanıcının gönderim hatası diğerlerini engellemez.
 */
export async function sendDailyDigest(
  client: EmailClient = resendClient,
): Promise<number> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const since = new Date(
    Date.now() - DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  try {
    const digests = await collectDigests(since);
    let sent = 0;
    for (const digest of digests) {
      try {
        await client.send(
          dailyDigestTemplate(digest.recipient.email, {
            userName: digest.recipient.name,
            conversations: digest.conversations
              .slice(0, DIGEST_MAX_CONVERSATIONS)
              .map((conversation) => ({
                id: conversation.id,
                listingTitle: conversation.listingTitle,
                preview: conversation.preview,
                unreadCount: conversation.unreadCount,
                url: `${baseUrl}/hesap/mesajlar/${conversation.id}`,
              })),
          }),
        );
        sent += 1;
      } catch (error) {
        // Bir kullanıcının maili gönderilemezse özet durmaz.
        console.error(
          `[email] sendDailyDigest gönderimi başarısız (${digest.recipient.email}):`,
          error,
        );
      }
    }
    return sent;
  } catch (error) {
    console.error("[email] sendDailyDigest çalıştırması başarısız:", error);
    return 0;
  }
}
