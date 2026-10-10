import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { demoListings } from "@/lib/demo-data";
import { AccountShell } from "@/components/account-shell";
import { ListingWizard } from "@/components/listing-wizard";

export const metadata: Metadata = { title: "İlanı düzenle" };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = demoListings.find((item) => item.id === id);
  if (!listing) notFound();
  return <AccountShell title="Örnek ilanı düzenle" description="Alanlar mevcut demo ilanla dolduruldu. Değişiklikler sunucuya kaydedilmez."><Link href="/hesap/ilanlarim" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-forest"><ArrowLeft size={16} /> İlanlarıma dön</Link><ListingWizard initial={listing} /></AccountShell>;
}
