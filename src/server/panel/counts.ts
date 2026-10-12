import { prisma } from "../../lib/prisma";
import type {
  AccountCounts,
  AdminCounts,
} from "../../components/panel/nav";

// Panel sayaç çekirdeği — sunucu layout'ları (Tasks 5 & 9) menü rozetlerini
// buradan besler. Yalnız dar `count` sorguları; satır çekilmez.
//
// Okunmamış mesaj kuralı, mevcut `/api/messages/unread-count` ucu
// (src/app/api/messages/unread-count/route.ts:20-28) ve mesaj service'i
// (getConversationsCore, src/server/messages/service.ts:242-250) ile BİREBİR
// aynıdır: kullanıcının katıldığı sohbette başkasının gönderdiği, readAt=null
// mesajlar. Böylece sidebar rozeti ile topbar SWR rozeti asla ayrışmaz.
// Kuralı değiştirmeyin — tek doğruluk kaynağı budur.

/**
 * `/hesap` menü rozetlerinin sunucu tarafı sayaçları.
 * - `listings`: kullanıcının sahip olduğu ilanlar
 * - `pendingIncoming`: kullanıcının ilanlarına gelen PENDING talepler
 * - `unreadMessages`: yukarıdaki okunmamış mesaj kuralı
 */
export async function getAccountCounts(userId: string): Promise<AccountCounts> {
  const [listings, pendingIncoming, unreadMessages] = await Promise.all([
    prisma.listing.count({ where: { ownerId: userId } }),
    prisma.bookingRequest.count({
      where: { status: "PENDING", listing: { ownerId: userId } },
    }),
    prisma.message.count({
      where: {
        senderId: { not: userId },
        readAt: null,
        conversation: { OR: [{ renterId: userId }, { ownerId: userId }] },
      },
    }),
  ]);

  return { listings, pendingIncoming, unreadMessages };
}

/**
 * `/admin` menü rozetlerinin sunucu tarafı sayaçları.
 * - `pendingListings`: moderasyon bekleyen (PENDING) ilanlar
 * - `openReports`: açık (OPEN) şikâyetler
 */
export async function getAdminCounts(): Promise<AdminCounts> {
  const [pendingListings, openReports] = await Promise.all([
    prisma.listing.count({ where: { status: "PENDING" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
  ]);

  return { pendingListings, openReports };
}
