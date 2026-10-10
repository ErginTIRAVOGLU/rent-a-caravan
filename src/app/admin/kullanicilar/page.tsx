import type { Metadata } from "next";

import { requireAdmin } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { UserBanActions } from "./UserBanActions";

export const metadata: Metadata = {
  title: "Kullanıcılar — Yönetim",
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
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Kullanıcılar</h1>
      <p className="mt-1 text-sm text-gray-600">
        Kayıtlı hesapları inceleyin; gerektiğinde banlayın veya banı açın.
      </p>

      {users.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-600">Kayıtlı kullanıcı yok.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold text-gray-900">
                    {user.name}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      user.role === "ADMIN"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {user.role === "ADMIN" ? "Yönetici" : "Üye"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      user.isBanned
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {user.isBanned ? "Banlı" : "Aktif"}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-gray-600">
                  {user.email} · Üyelik: {formatDate(user.createdAt)}
                </p>
              </div>
              <div className="shrink-0">
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
