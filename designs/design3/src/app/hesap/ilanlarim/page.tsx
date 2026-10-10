import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { ListingManager } from "@/components/listing-manager";

export const metadata: Metadata = { title: "İlanlarım" };

export default function MyListingsPage() {
  return <AccountShell title="İlanların" description="Karavan ilanlarını ve örnek durumlarını tek yerde takip et."><ListingManager /></AccountShell>;
}
