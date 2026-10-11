import { getSessionUser } from "@/lib/auth";
import { getConversationsCore } from "@/server/messages/service";

export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Oturum bulunamadı. Lütfen yeniden giriş yapın." }, { status: 401 });
  }
  const result = await getConversationsCore(user);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }
  return Response.json(result.data);
}
