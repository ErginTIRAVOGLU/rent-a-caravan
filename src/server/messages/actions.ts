"use server";

import type { Message } from "@prisma/client";

import { requireUser } from "../../lib/auth";
import { type ActionResult } from "../../lib/result";
import {
  getConversationCore,
  getConversationsCore,
  markMessagesReadCore,
  sendMessageCore,
  startConversationCore,
  type ConversationThread,
  type ConversationWithDetails,
} from "./service";

/** Sohbet başlat veya var olanı getir — oturum kapısı. */
export async function startConversation(
  listingId: string,
): Promise<ActionResult<ConversationWithDetails>> {
  const user = await requireUser();
  return await startConversationCore(user, listingId);
}

/** Mesaj gönder — oturum kapısı. */
export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<ActionResult<Message>> {
  const user = await requireUser();
  return await sendMessageCore(user, conversationId, content);
}

/** Mesajları okundu işaretle — oturum kapısı. */
export async function markMessagesRead(
  conversationId: string,
): Promise<ActionResult<number>> {
  const user = await requireUser();
  return await markMessagesReadCore(user, conversationId);
}

/** Sohbet listesi — oturum kapısı. */
export async function getConversations(): Promise<
  ActionResult<ConversationWithDetails[]>
> {
  const user = await requireUser();
  return await getConversationsCore(user);
}

/** Sohbet detayı — oturum kapısı. */
export async function getConversation(
  conversationId: string,
): Promise<ActionResult<ConversationThread>> {
  const user = await requireUser();
  return await getConversationCore(user, conversationId);
}
