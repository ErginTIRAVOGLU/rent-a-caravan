<<<<<<< HEAD
 
=======
>>>>>>> 64ab8a7e988a8edd4699c9b0b1b26e5e3fb5451f
import NextAuth from "next-auth";

import { authConfig } from "./lib/auth.config";

<<<<<<< HEAD
// Keep the proxy configuration edge-safe and free of Prisma and bcrypt.
// Detailed authorization remains in requireUser and requireAdmin.
const { auth: proxy } = NextAuth(authConfig);

export default proxy;
=======
// İnce ilk kapı: yalnızca edge-güvenli taban yapılandırma (prisma/bcrypt
// içermez — tam yapılandırma `src/lib/auth.ts`'tedir ve Node tarafında kalır).
// Coarse yönlendirmeler `authConfig.callbacks.authorized` içinde; asıl denetim
// sayfa/aksiyonlardaki `requireUser`/`requireAdmin`'dadır.
//
// NOT: Next.js 16 `middleware.ts` dosya geleneğini `proxy.ts` lehine kaldırdı;
// içerik aynıdır, yalnız dosya adı değişti.
const { auth: middleware } = NextAuth(authConfig);

export default middleware;
>>>>>>> 64ab8a7e988a8edd4699c9b0b1b26e5e3fb5451f

export const config = {
  matcher: ["/hesap/:path*", "/admin/:path*"],
};
<<<<<<< HEAD
 
=======
>>>>>>> 64ab8a7e988a8edd4699c9b0b1b26e5e3fb5451f
