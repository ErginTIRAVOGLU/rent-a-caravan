import type { Metadata } from "next";

import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { PageHeader } from "../../../components/panel/PageHeader";
import { ReportDialog } from "../../../components/ReportDialog";
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
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Hesabım"
        title="Profil"
        description="Adınızı ve telefonunuzu güncelleyin, şifrenizi değiştirin."
      />

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

      {/* Hesap bildirimi (spec §8): hedef USER = oturumdaki hesap. Yönetim
          ekibi bildirimi şikayet kuyruğunda inceler; otomasyon yok. */}
      <section className="card mt-6 p-5">
        <h2 className="section-title">Hesap Bildirimi</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Hesabınızla ilgili bir sorunu (ör. ele geçirilme, sahte içerik) yönetim
          ekibine iletin. Bildiriminiz incelenene kadar açık kalır.
        </p>
        <ReportDialog targetType="USER" targetId={sessionUser.id} />
      </section>
    </div>
  );
}
