import NextAuth from "next-auth";

import { authConfig } from "./lib/auth.config";

// İnce ilk kapı: yalnızca edge-güvenli taban yapılandırma (prisma/bcrypt
// içermez — tam yapılandırma `src/lib/auth.ts`'tedir ve Node tarafında kalır).
// Coarse yönlendirmeler `authConfig.callbacks.authorized` içinde; asıl denetim
// sayfa/aksiyonlardaki `requireUser`/`requireAdmin`'dadır.
const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: ["/hesap/:path*", "/admin/:path*"],
};
