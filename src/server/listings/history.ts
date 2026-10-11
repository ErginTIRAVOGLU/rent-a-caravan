import type { ListingStatus, Prisma } from "@prisma/client";

// İlan durum geçmişi yazımı — HER durum geçişinde bir satır (admin
// approve/reject/pause/unpause + owner pause/submit). actorId işlemi yapan
// kullanıcı id'si, sistem/cron geçişlerinde "system". reason yalnız
// gerekçeli geçişlerde dolar (admin reject).
//
// İmza `Prisma.TransactionClient` alır: çağıran çekirdekler geçişi zaten
// transaction içinde yapar, history satırı aynı tx'e yazılır (ya hep ya hiç).

export const SYSTEM_ACTOR_ID = "system";

type HistoryWriter = Pick<Prisma.TransactionClient, "listingStatusHistory">;

export async function recordStatusChange(
  tx: HistoryWriter,
  input: {
    listingId: string;
    fromStatus: ListingStatus;
    toStatus: ListingStatus;
    actorId: string;
    reason?: string;
  },
): Promise<void> {
  await tx.listingStatusHistory.create({
    data: {
      listingId: input.listingId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId,
      reason: input.reason ?? null,
    },
  });
}
