import type { Metadata } from "next";

import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { AccountNav } from "../../../components/AccountNav";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = {
  title: "Profilim — Karavan Kiralama",
};

// Profil sayfası — sunucu bileşeni: mevcut ad/telefon form başlangıç değeri
// olarak okunur; güncelleme `updateProfileAction` (requireUser kapılı) yapar.

export default async function ProfilPage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, email: true, phone: true },
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Profilim</h1>
          <p className="mt-1 text-sm text-gray-600">
            Adınızı ve telefonunuzu güncelleyin, şifrenizi değiştirin.
          </p>
        </header>

        <AccountNav current="profil" />

        <ProfileForm
          email={user?.email ?? sessionUser.email}
          initialName={user?.name ?? sessionUser.name}
          initialPhone={user?.phone ?? ""}
        />
      </div>
    </main>
  );
}
