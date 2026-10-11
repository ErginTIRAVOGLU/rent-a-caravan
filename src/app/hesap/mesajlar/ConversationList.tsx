"use client";

import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";

import type { Conversation } from "@prisma/client";
import { formatRelativeTime } from "../../../lib/format";

type ConversationWithUnread = Conversation & {
  listing: { id: string; title: string; photoUrls: string[]; status: string };
  renter: { id: string; name: string; avatarUrl: string | null };
  owner: { id: string; name: string; avatarUrl: string | null };
  _count: { messages: number };
  unreadCount: number;
};

type Props = {
  initialConversations: ConversationWithUnread[];
  userId: string;
};

export function ConversationList({ initialConversations, userId }: Props) {
  const { data: conversations } = useSWR<ConversationWithUnread[]>(
    "/api/conversations",
    { fallbackData: initialConversations, refreshInterval: 15000 },
  );

  if (!conversations || conversations.length === 0) {
    return (
      <div className="card mt-3 p-6 text-center">
        <span className="material-symbols-outlined text-3xl text-outline">chat_bubble_outline</span>
        <p className="mt-2 font-semibold text-on-surface">Henüz mesajınız yok</p>
        <Link href="/arama" className="btn btn-primary btn-sm mt-4">
          Karavan Arayın
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-3 space-y-3" role="list" aria-label="Sohbet listesi">
      {conversations.map((conv) => {
        const isRenter = conv.renterId === userId;
        const otherParty = isRenter ? conv.owner : conv.renter;
        const lastMessageTime = conv.lastMessageAt
          ? formatRelativeTime(new Date(conv.lastMessageAt))
          : "Yeni sohbet";
        const preview = conv.lastMessagePreview
          ? conv.lastMessagePreview.slice(0, 80)
          : "Henüz mesaj yok";

        return (
          <li key={conv.id}>
            <Link
              href={`/hesap/mesajlar/${conv.id}`}
              className="card block p-4 hover:bg-surface-low transition-colors group"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {conv.listing.photoUrls[0] ? (
                    <Image
                      src={conv.listing.photoUrls[0]}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-mid text-outline">
                      <span className="material-symbols-outlined text-xl">directions_car</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-on-surface">{conv.listing.title}</h3>
                    <p className="mt-0.5 truncate text-body-sm text-on-surface-variant">
                      {otherParty.name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <time className="text-body-xs text-on-surface-variant whitespace-nowrap">
                    {lastMessageTime}
                  </time>
                  {conv.unreadCount > 0 && (
                    <span className="badge badge-accent text-body-xs" aria-label={`${conv.unreadCount} okunmamış mesaj`}>
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 truncate text-body-sm text-on-surface-variant">{preview}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
