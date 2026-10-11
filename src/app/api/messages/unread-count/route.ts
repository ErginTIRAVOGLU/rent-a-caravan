import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

/**
 * GET /api/messages/unread-count
 * Returns the count of unread messages for the current user.
 */
export async function GET() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || user.isBanned) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  // Tüm zamanların okunmamış sayısı (rozet semantiği "okunmamış"):
  // kullanıcının dahil olduğu sohbetlerde başkasının gönderdiği,
  // henüz okunmamış mesajlar.
  const unreadCount = await prisma.message.count({
    where: {
      senderId: { not: user.id },
      readAt: null,
      conversation: {
        OR: [{ renterId: user.id }, { ownerId: user.id }],
      },
    },
  });

  return NextResponse.json({ count: unreadCount });
}
