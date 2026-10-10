-- Mükerrer koruması atomik (T9): aynı kiracı + aynı ilanda EN FAZLA TEK
-- bekleyen (PENDING) talep. Bu, check-then-act yarışını DB constraint'iyle
-- kapatır — eşzamanlı ikinci create yazımı burada düşer (service P2002 yakalar).
--
-- Partial index bilinçli: yalnız PENDING satırlarını kapsar. Böylece onaylı/
-- reddedilmiş/iptal edilmiş geçmiş kayıtlar (APPROVED/REJECTED/CANCELLED)
-- kısıtlanmaz; aynı kiracı ilan için yeniden talep oluşturabilir.
CREATE UNIQUE INDEX "bookingRequest_listingId_renterId_pending_key"
ON "BookingRequest" ("listingId", "renterId")
WHERE "status" = 'PENDING';
