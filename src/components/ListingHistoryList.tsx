import type { ListingStatus } from "@prisma/client";

import { SYSTEM_ACTOR_ID } from "../server/listings/history";

// İlan durum geçmişi listesi — sahip tarafı (hesap/ilanlarim/[id]/gecmis) ve
// admin önizleme (admin/ilanlar/[id]) aynı bileşeni kullanır. entries
// kronolojik (eskiden yeniye) verilir; actorLabel sayfada çözülür
// (Sistem / İlan sahibi / Yönetici — history'de yalnız actorId saklanır).

const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Taslak",
  PENDING: "İncelemede",
  ACTIVE: "Yayında",
  REJECTED: "Reddedildi",
  PAUSED: "Duraklatıldı",
};

export type HistoryEntry = {
  id: string;
  fromStatus: ListingStatus;
  toStatus: ListingStatus;
  actorLabel: string;
  reason: string | null;
  createdAt: Date;
};

/**
 * actorId → Türkçe etiket: history'de yalnız id saklanır; geçişi yalnız
 * sahip + adminler (+ sistem) yapabildiği için sahip-dışı insan = yönetici.
 */
export function actorLabelFor(actorId: string, ownerId: string): string {
  if (actorId === SYSTEM_ACTOR_ID) {
    return "Sistem";
  }
  return actorId === ownerId ? "İlan sahibi" : "Yönetici";
}

export function ListingHistoryList({
  entries,
}: {
  entries: HistoryEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="py-2 text-sm text-gray-500">
        Bu ilan için henüz durum geçmişi yok.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-gray-100">
      {entries.map((entry) => (
        <li key={entry.id} className="py-3">
          <p className="text-sm font-semibold text-gray-900">
            {STATUS_LABELS[entry.fromStatus]} → {STATUS_LABELS[entry.toStatus]}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            <span>
              {entry.createdAt.toLocaleDateString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>{" "}
            · <span>{entry.actorLabel}</span>
          </p>
          {entry.reason ? (
            <p className="mt-1 break-words text-sm text-gray-700">
              {entry.reason}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
