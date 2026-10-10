import { getSessionUser } from "@/lib/auth";
import { getConversationCore } from "@/server/messages/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Oturum bulunamadı. Lütfen yeniden giriş yapın." }, { status: 401 });
  }
  const result = await getConversationCore(user, id);
  if (!result.ok) {
    const status = result.error === "Sohbet bulunamadı." ? 404 : 403;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result.data);
}
