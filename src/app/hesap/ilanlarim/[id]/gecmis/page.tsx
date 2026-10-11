import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
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
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/hesap/ilanlarim"
        className="inline-flex items-center gap-1 text-body-md text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        İlanlarıma dön
      </Link>

      <span className="eyebrow mt-3 block">Hesabım</span>
      <h1 className="mt-1 text-headline-lg font-bold text-primary">
        İlan Geçmişi
      </h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        {listing.title}
      </p>

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
