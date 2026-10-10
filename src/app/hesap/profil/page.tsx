import type { Metadata } from "next";

import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { AccountNav } from "../../../components/AccountNav";
import { ProfileForm } from "./ProfileForm";
import { ReviewsVisibleToggle } from "./ReviewsVisibleToggle";

export const metadata: Metadata = {
  title: "Profil",
};

export default async function ProfilPage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, email: true, phone: true, reviewsVisible: true },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <span className="eyebrow">Hesabım</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">Profil</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Adınızı ve telefonunuzu güncelleyin, şifrenizi değiştirin.
        </p>
      </header>

      <AccountNav current="profil" />

      <ProfileForm
        email={user?.email ?? sessionUser.email}
        initialName={user?.name ?? sessionUser.name}
        initialPhone={user?.phone ?? ""}
      />

      <section className="card mt-6 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="section-title">Yorum Görünürlüğü</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              İlanlarınıza yazılan yorumların ilan detayında gösterilmesini
              açın veya kapatın. Kapalıyken yorumlar gizlenir.
            </p>
          </div>
          <ReviewsVisibleToggle
            key={String(user?.reviewsVisible ?? true)}
            current={user?.reviewsVisible ?? true}
          />
        </div>
      </section>
    </div>
  );
}
