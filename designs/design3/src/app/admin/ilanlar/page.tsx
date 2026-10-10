import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { AdminListingManager } from "@/components/admin-listing-manager";

export const metadata: Metadata = { title: "İlan moderasyonu" };

export default function AdminListingsPage() {
  return <AccountShell admin title="İlan moderasyonu" description="Bekleyen örnek ilanları incele, durumlarını ve gerekçeleri demo olarak yönet."><AdminListingManager /></AccountShell>;
}
