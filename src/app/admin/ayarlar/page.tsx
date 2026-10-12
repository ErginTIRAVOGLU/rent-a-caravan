import type { Metadata } from "next";

import { requireAdmin } from "../../../lib/auth";
import { getReviewsEnabledCore } from "../../../server/admin/service";
import { SettingActions } from "./SettingActions";

export const metadata: Metadata = {
  title: "Ayarlar — Yönetim",
};

export default async function AdminSettingsPage() {
  await requireAdmin();

  const reviewsEnabled = await getReviewsEnabledCore();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <span className="eyebrow">Yönetim</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">Ayarlar</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Platform genel ayarları. Değişiklikler anlık uygulanır.
        </p>
      </header>

      <section className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="section-title">Yorum Sistemi</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Tüm ilanlarda yorum yazılmasına ve gösterilmesine izin ver.
              Kapalıyken mevcut yorumlar gizlenir ve yeni yorum engellenir.
            </p>
          </div>
          <SettingActions key="reviewsEnabled" current={reviewsEnabled} />
        </div>
      </section>
    </div>
  );
}