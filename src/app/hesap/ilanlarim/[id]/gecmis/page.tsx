import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { PageHeader } from "../../../../../components/panel/PageHeader";
import {
  actorLabelFor,
  ListingHistoryList,
} from "../../../../../components/ListingHistoryList";

export const metadata: Metadata = {
  title: "İlan Geçmişi",
};

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * İlan durum geçmişi (sahip tarafı). Sahip-sadece: ilan `ownerId = user.id`
 * koşuluyla okunur, başkasının ilanı 404 verir. Geçişler kronolojik
 * (eskiden yeniye) listelenir: tarih + eski→yeni + kim + gerekçe.
 */
export default async function ListingHistoryPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const listing = await prisma.listing.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true, ownerId: true, title: true },
  });
  if (!listing) {
    notFound();
  }

  const history = await prisma.listingStatusHistory.findMany({
    where: { listingId: listing.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        href="/hesap/ilanlarim"
        className="inline-flex items-center gap-1 text-body-md text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        İlanlarıma dön
      </Link>

      <PageHeader
        eyebrow="Hesabım"
        title="İlan Geçmişi"
        description={listing.title}
      />

      <section className="card mt-6 p-4 sm:p-5">
        <ListingHistoryList
          entries={history.map((entry) => ({
            id: entry.id,
            fromStatus: entry.fromStatus,
            toStatus: entry.toStatus,
            actorLabel: actorLabelFor(entry.actorId, listing.ownerId),
            reason: entry.reason,
            createdAt: entry.createdAt,
          }))}
        />
      </section>
    </div>
  );
}
