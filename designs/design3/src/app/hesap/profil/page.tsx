import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { ProfileForm } from "@/components/profile-form";

export const metadata: Metadata = { title: "Profil" };

export default function ProfilePage() {
  return <AccountShell title="Profil bilgileri" description="Örnek form alanlarını gözden geçir. Değişiklikler kalıcı olarak kaydedilmez."><ProfileForm /></AccountShell>;
}
