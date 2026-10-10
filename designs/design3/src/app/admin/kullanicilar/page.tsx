import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { AdminUserManager } from "@/components/admin-user-manager";

export const metadata: Metadata = { title: "Kullanıcılar" };

export default function AdminUsersPage() {
  return <AccountShell admin title="Kullanıcılar" description="Örnek kullanıcı kayıtlarını ve erişim durumlarını görüntüle."><AdminUserManager /></AccountShell>;
}
