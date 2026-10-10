import type { Metadata } from "next";

import { requireAdmin } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { UserBanActions } from "./UserBanActions";

export const metadata: Metadata = {
  title: "Kullanıcılar",
};

/** @db/timestamp → DD.MM.YYYY (UTC; saat dilimi kaymaz). */
function formatDate(value: Date): string {
  const dd = String(value.getUTCDate()).padStart(2, "0");
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${value.getUTCFullYear()}`;
}

/**
 * Kullanıcı listesi: rol/ban rozetleri ve Ban/Aç toggle. Ban korumaları
 * (kendi hesap, son aktif yönetici) service'te uygulanır; hata satırda
 * Türkçe gösterilir.
 */
export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    // passwordHash render kapsamına hiç alınmaz (asgari yetki hijyeni).
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isBanned: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-12">
      <header className="mb-6">
        <span className="eyebrow">Yönetim</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">Kullanıcılar</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Kayıtlı hesapları inceleyin; gerektiğinde banlayın veya banı açın.
        </p>
      </header>

      {users.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-outline">people</span>
          <p className="mt-2 font-semibold text-on-surface">Kayıtlı kullanıcı yok</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {users.map((user) => (
            <li
              key={user.id}
              className="card p-4 sm:p-5 sm:flex sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-bold text-on-surface">{user.name}</h2>
                  <span
                    className={`badge ${
                      user.role === "ADMIN"
                        ? "badge-primary"
                        : "badge-neutral"
                    }`}
                  >
                    {user.role === "ADMIN" ? "Yönetici" : "Üye"}
                  </span>
                  <span
                    className={`badge ${
                      user.isBanned ? "badge-error" : "badge-success"
                    }`}
                  >
                    {user.isBanned ? "Banlı" : "Aktif"}
                  </span>
                </div>
                <p className="mt-1 truncate text-body-md text-on-surface-variant">
                  {user.email} · Üyelik: {formatDate(user.createdAt)}
                </p>
              </div>
              <div className="shrink-0 mt-3 sm:mt-0">
                <UserBanActions
                  userId={user.id}
                  isBanned={user.isBanned}
                  isSelf={user.id === admin.id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
