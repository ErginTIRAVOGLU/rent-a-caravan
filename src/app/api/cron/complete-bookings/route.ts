import { completeDueBookings } from "../../../../server/bookings/service";

// Günlük tamamlama cron'u (vercel.json, 03:00 UTC — "0 3 * * *"). Vercel, cron
// çağrılarına `CRON_SECRET` ortam değişkeni tanımlıysa otomatik olarak
// `Authorization: Bearer ${CRON_SECRET}` başlığı ekler; burada doğrulanır.
// Eşitlik düz karşılaştırma: sır sabit, uzun ve makine kullanımı tek
// kullanımlıktır — zamanlama (timing) sızıntısı pratik risk taşımaz.
// Secret tanımsızsa fail-closed: her istek 401 (cron devre dışı).
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const completed = await completeDueBookings();
  return Response.json({ completed });
}
