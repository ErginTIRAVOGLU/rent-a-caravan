import { getSessionUser } from "@/lib/auth";
import { getConversationsCore } from "@/server/messages/service";

export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return Response.json(
      { ok: false, error: "Oturum bulunamadı. Lütfen yeniden giriş yapın." },
      { status: 401 },
    );
  }
  const result = await getConversationsCore(user);
  return Response.json(result);
}
