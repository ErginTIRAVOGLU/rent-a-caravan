import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "../../../../lib/auth";
import { getConversation } from "../../../../server/messages/actions";
import { PageHeader } from "../../../../components/panel/PageHeader";
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
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Hesabım" title="Sohbet" />

      <ConversationThread
        initialConversation={result.data}
        currentUserId={user.id}
      />
    </div>
  );
}
