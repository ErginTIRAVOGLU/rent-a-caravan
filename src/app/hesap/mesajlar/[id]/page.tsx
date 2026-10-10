import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "../../../../lib/auth";
import { getConversation } from "../../../../server/messages/actions";
import { AccountNav } from "../../../../components/AccountNav";
import { ConversationThread } from "./ConversationThread";

export const metadata: Metadata = {
  title: "Sohbet",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ConversationPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  const result = await getConversation(id);
  if (!result.ok || !result.data) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <span className="eyebrow">Hesabım</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">Sohbet</h1>
      </header>

      <AccountNav current="mesajlar" />

      <ConversationThread
        initialConversation={result.data}
        currentUserId={user.id}
      />
    </div>
  );
}