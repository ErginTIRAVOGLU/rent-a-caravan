import { sendDailyDigest } from "../../../../lib/email/events";

// Günlük mesaj özeti cron'u (T9, vercel.json "0 9 * * *" — 09:00 UTC = 12:00 TR):
// okunmamış mesajı olan kullanıcılara günde bir özet e-postası.
//
// complete-bookings route'u ile aynı güvenlik sözleşmesi: Vercel `CRON_SECRET`
// tanımlıysa `Authorization: Bearer ${CRON_SECRET}` başlığını kendi ekler;
// eşleşmezse (veya secret tanımsızsa) fail-closed 401 — hiçbir e-posta
// gönderilmez. Dönen değer: gerçekten gönderilen e-posta sayısı (kullanıcı
// başına bir). `sendDailyDigest` hataları yutup 0 döndüğü için route'da ayrı
// try/catch yoktur — cron'u 500'e düşürmek yalnızca gereksiz bir yeniden
// denemeye yol açar.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sent = await sendDailyDigest();
  return Response.json({ sent });
}
