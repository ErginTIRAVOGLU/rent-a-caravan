import type { Metadata } from "next";
import type { Conversation } from "@prisma/client";

import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { AccountNav } from "../../../components/AccountNav";
import { ConversationList } from "./ConversationList";

export const metadata: Metadata = {
  title: "Mesajlarım",
};

type ConversationWithUnread = Conversation & {
  listing: { id: string; title: string; photoUrls: string[]; status: string };
  renter: { id: string; name: string; avatarUrl: string | null };
  owner: { id: string; name: string; avatarUrl: string | null };
  _count: { messages: number };
  unreadCount: number;
};

export default async function MesajlarPage() {
  const user = await requireUser();

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
    unreadCounts.map((u: { conversationId: string; _count: { id: number } }) => [u.conversationId, u._count.id]),
  );

  const conversationsWithUnread: ConversationWithUnread[] = conversations.map((c) => ({
    ...c,
    unreadCount: unreadMap.get(c.id) ?? 0,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <span className="eyebrow">Hesabım</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">Mesajlarım</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Kiracılar ve ilan sahipleriyle konuşmalarınızı yönetin.
        </p>
      </header>

      <AccountNav current="mesajlar" />

      <ConversationList initialConversations={conversationsWithUnread} userId={user.id} />
    </div>
  );
}
