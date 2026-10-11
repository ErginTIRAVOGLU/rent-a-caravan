"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import useSWR from "swr";

import type { Conversation, Message, User } from "@prisma/client";
import { formatRelativeTime } from "../../../../lib/format";
import { sendMessage, markMessagesRead } from "../../../../server/messages/actions";

type ConversationThreadData = Conversation & {
  listing: { id: string; title: string; photoUrls: string[]; status: string };
  renter: { id: string; name: string; avatarUrl: string | null };
  owner: { id: string; name: string; avatarUrl: string | null };
  messages: (Message & { sender: Pick<User, "id" | "name" | "avatarUrl"> })[];
  bookingStatus: string | null;
};

type Props = {
  initialConversation: ConversationThreadData;
  currentUserId: string;
};

export function ConversationThread({
  initialConversation,
  currentUserId,
}: Props) {
  const [optimisticMessages, setOptimisticMessages] = useState<
    (Message & { sender: Pick<User, "id" | "name" | "avatarUrl">; optimistic?: boolean })[]
  >([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasMarkedRead = useRef(false);
  /** İlk yüklemede alta kaydırılır; sonrasında yalnız alta yakınken / kendi mesajında. */
  const isFirstLoad = useRef(true);
  /** Kendi mesajı gönderildiğinde bir sonraki render'da alta kaydır. */
  const scrollForOwnMessage = useRef(false);

  const { data: conversation, mutate } = useSWR<ConversationThreadData>(
    `/api/conversations/${initialConversation.id}`,
    { fallbackData: initialConversation, refreshInterval: 5000 },
  );

  // Mark messages as read on mount
  useEffect(() => {
    if (conversation && !hasMarkedRead.current) {
      hasMarkedRead.current = true;
      markMessagesRead(conversation.id).catch(console.error);
    }
  }, [conversation]);

  // Alta kaydırma: yalnız ilk yüklemede, kendi mesajı gönderilince veya
  // kullanıcı zaten alta yakınken (poll güncellemesi geçmiş okumayı bölmez).
  useEffect(() => {
    const container = scrollContainerRef.current;
    const end = messagesEndRef.current;
    if (!container || !end) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      end.scrollIntoView();
      return;
    }
    if (scrollForOwnMessage.current) {
      scrollForOwnMessage.current = false;
      end.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 120) {
      end.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages, optimisticMessages]);

  // Sunucu verisine yansıyan optimistic mesajları temizle (bire bir eşleşme:
  // aynı içerikten iki kez gönderildiyse yalnız yankılanan kadar silinir).
  // Eski geçmişteki aynı içerikli mesajlar createdAt korumasıyla elenmez.
  useEffect(() => {
    const serverMessages = conversation?.messages ?? [];
    if (serverMessages.length === 0) return;
    setOptimisticMessages((prev) => {
      if (prev.length === 0) return prev;
      const remaining = [...prev];
      for (const server of serverMessages) {
        const serverTime = new Date(server.createdAt).getTime();
        const index = remaining.findIndex(
          (opt) =>
            opt.senderId === server.senderId &&
            opt.content === server.content &&
            serverTime >= new Date(opt.createdAt).getTime() - 1000,
        );
        if (index >= 0) remaining.splice(index, 1);
      }
      return remaining.length === prev.length ? prev : remaining;
    });
  }, [conversation?.messages]);

  const allMessages = [
    ...(conversation?.messages ?? []).map((m) => ({ ...m, optimistic: false as const })),
    ...optimisticMessages,
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const isRenter = conversation?.renterId === currentUserId;
  const otherParty = isRenter ? conversation?.owner : conversation?.renter;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversation) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const content = formData.get("content")?.toString().trim();
    if (!content) return;

    setPending(true);
    setError(null);

    // Optimistic message
    const optimisticMessage: Message & {
      sender: Pick<User, "id" | "name" | "avatarUrl">;
      optimistic: boolean;
    } = {
      id: `opt-${Date.now()}`,
      conversationId: conversation.id,
      senderId: currentUserId,
      content,
      readAt: null,
      createdAt: new Date(),
      sender: { id: currentUserId, name: "Siz", avatarUrl: null },
      optimistic: true,
    };
    setOptimisticMessages((prev) => [...prev, optimisticMessage]);
    scrollForOwnMessage.current = true;

    try {
      const result = await sendMessage(conversation.id, content);
      if (!result.ok) {
        setError(result.error);
        // Remove optimistic message on error
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        return;
      }
      // Optimistic mesaj sunucu yankısı gelene kadar tutulur (dedupe effect'i
      // temizler); revalidation yankıyı getirir, arada boşluk olmaz.
      form.reset();
      await mutate();
    } catch {
      setError("Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.");
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
    } finally {
      setPending(false);
    }
  }

  if (!conversation) {
    return (
      <div className="card p-6 text-center">
        <span className="material-symbols-outlined text-3xl text-outline">chat_bubble_outline</span>
        <p className="mt-2 font-semibold text-on-surface">Sohbet yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sohbet başlığı */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          {conversation.listing.photoUrls[0] ? (
            <Image
              src={conversation.listing.photoUrls[0]}
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
          <div className="min-w-0 flex-1">
            <Link
              href={`/ilan/${conversation.listing.id}`}
              className="truncate font-bold text-on-surface hover:text-primary hover:underline"
            >
              {conversation.listing.title}
            </Link>
            <p className="mt-0.5 truncate text-body-sm text-on-surface-variant">
              {otherParty?.name}
            </p>
          </div>
          {conversation.bookingStatus && (
            <span className="badge badge-info shrink-0">{conversation.bookingStatus}</span>
          )}
        </div>
      </div>

      {/* Mesaj listesi */}
      <div
        ref={scrollContainerRef}
        className="card p-4 h-[500px] overflow-y-auto space-y-4"
        role="log"
        aria-live="polite"
      >
        {allMessages.length === 0 ? (
          <p className="text-center text-body-md text-on-surface-variant mt-8">
            Henüz mesaj yok. İlk mesajı siz gönderin!
          </p>
        ) : (
          allMessages.map((msg) => {
            const isOwn = msg.senderId === currentUserId;
            const time = formatRelativeTime(new Date(msg.createdAt));
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""} ${
                  msg.optimistic ? "opacity-70" : ""
                }`}
              >
                {!isOwn && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-title-sm font-bold text-white">
                    {msg.sender.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div
                  className={`max-w-[70%] ${
                    isOwn
                      ? "rounded-tr-none rounded-bl-lg rounded-br-lg bg-accent text-white"
                      : "rounded-tl-none rounded-bl-lg rounded-br-lg bg-surface-low text-on-surface"
                  } px-3 py-2`}
                >
                  <p className="text-body-md whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`mt-1 text-right text-body-xs ${isOwn ? "text-white/70" : "text-on-surface-variant/70"}`}>
                    {time}
                    {isOwn && msg.optimistic && <span className="ml-1">(gönderiliyor…)</span>}
                  </p>
                </div>
                {isOwn && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-title-sm font-bold text-white">
                    S
                  </span>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mesaj gönderim formu */}
      <form onSubmit={handleSubmit} className="card p-4">
        {error && (
          <p role="alert" className="mb-3 text-body-md text-error">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <input
            name="content"
            type="text"
            maxLength={2000}
            placeholder="Mesajınızı yazın…"
            disabled={pending}
            className="input flex-1 min-h-11 py-3"
            aria-label="Mesaj içeriği"
          />
          <button
            type="submit"
            disabled={pending}
            className="btn btn-accent shrink-0 min-h-11 px-4"
          >
            {pending ? "Gönderiliyor…" : "Gönder"}
          </button>
        </div>
        <p className="mt-2 text-body-xs text-on-surface-variant text-right">
          En fazla 2000 karakter
        </p>
      </form>
    </div>
  );
}
