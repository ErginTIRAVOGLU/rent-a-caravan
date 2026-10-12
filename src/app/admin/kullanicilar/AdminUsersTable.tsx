import type { Role } from "@prisma/client";

import { UserBanActions } from "./UserBanActions";

/** Admin kullanıcı listesi satırı (parola alanı render'a hiç girmez). */
export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isBanned: boolean;
  createdAt: Date;
};

/** @db/timestamp → DD.MM.YYYY (UTC; saat dilimi kaymaz). */
function formatDate(value: Date): string {
  const dd = String(value.getUTCDate()).padStart(2, "0");
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${value.getUTCFullYear()}`;
}

/** Rol rozeti — Yönetici/Üye. */
function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`badge ${role === "ADMIN" ? "badge-primary" : "badge-neutral"}`}
    >
      {role === "ADMIN" ? "Yönetici" : "Üye"}
    </span>
  );
}

/** Ban rozeti — Banlı/Aktif. */
function BanBadge({ isBanned }: { isBanned: boolean }) {
  return (
    <span className={`badge ${isBanned ? "badge-error" : "badge-success"}`}>
      {isBanned ? "Banlı" : "Aktif"}
    </span>
  );
}

/**
 * Admin kullanıcı listesi — masaüstünde tablo, mobilde aynı veriyi taşıyan
 * kartlar. Rol/ban rozetleri korunur; ban aksiyonu mevcut istemci adası
 * `UserBanActions`'tır (self satırında düğme yerine etiket gösterir).
 */
export function AdminUsersTable({
  users,
  adminId,
}: {
  users: AdminUserRow[];
  adminId: string;
}) {
  return (
    <>
      {/* Masaüstü tablo sunumu. */}
      <div
        data-testid="admin-users-table"
        className="hidden overflow-x-auto md:block"
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/60 text-label-md uppercase tracking-wider text-on-surface-variant">
              <th scope="col" className="px-3 py-3 font-medium">
                Kullanıcı
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Rol
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Durum
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Aksiyonlar
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-outline-variant/40 align-top last:border-0"
              >
                <td className="px-3 py-4">
                  <span className="block font-semibold text-on-surface">
                    {user.name}
                  </span>
                  <span className="block text-body-sm text-on-surface-variant">
                    {user.email} · Üyelik: {formatDate(user.createdAt)}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-3 py-4">
                  <BanBadge isBanned={user.isBanned} />
                </td>
                <td className="px-3 py-4">
                  <UserBanActions
                    userId={user.id}
                    isBanned={user.isBanned}
                    isSelf={user.id === adminId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil kart sunumu — aynı veri. */}
      <ul data-testid="admin-users-cards" className="space-y-4 md:hidden">
        {users.map((user) => (
          <li
            key={user.id}
            className="rounded-xl border border-outline-variant/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-bold text-on-surface">
                  {user.name}
                </h2>
                <p className="mt-1 break-words text-body-md text-on-surface-variant">
                  {user.email} · Üyelik: {formatDate(user.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <RoleBadge role={user.role} />
                <BanBadge isBanned={user.isBanned} />
              </div>
            </div>
            <div className="mt-4">
              <UserBanActions
                userId={user.id}
                isBanned={user.isBanned}
                isSelf={user.id === adminId}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
