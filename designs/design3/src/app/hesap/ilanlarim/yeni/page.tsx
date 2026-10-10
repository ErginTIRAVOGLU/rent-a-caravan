import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { ListingWizard } from "@/components/listing-wizard";

export const metadata: Metadata = { title: "Yeni ilan oluştur" };

export default function NewListingPage() {
  return <AccountShell title="Karavanını tanıt" description="Dört kısa adımda örnek ilanını hazırla. Bilgiler bu demo sürümünde kaydedilmez."><Link href="/hesap/ilanlarim" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-forest"><ArrowLeft size={16} /> İlanlarıma dön</Link><ListingWizard /></AccountShell>;
}
