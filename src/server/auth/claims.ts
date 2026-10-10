import { prisma } from "../../lib/prisma";

/**
 * Her `auth()` çağrısında (sunucu tarafında) kullanıcının güncel `role`,
 * `isBanned` ve `emailVerified` durumunu DB'den çekip token iddialarını
 * yeniler. Kullanıcı banlıysa veya bulunamazsa `null` döndürerek oturumu
 * geçersiz kılar.
 */
export async function refreshUserClaims(
  token: { sub?: string; role?: "USER" | "ADMIN"; isBanned?: boolean; emailVerified?: Date | null } | null
): Promise<typeof token | null> {
  if (!token?.sub) {
    return token;
  }
  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { role: true, isBanned: true, emailVerified: true },
  });
  if (!user) {
    return null; // kullanıcı silinmiş → oturum geçersiz
  }
  if (user.isBanned) {
    return null; // kullanıcı banlı → oturum geçersiz
  }
  token.role = user.role;
  token.isBanned = user.isBanned;
  token.emailVerified = user.emailVerified;
  return token;
}