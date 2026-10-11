 
import NextAuth from "next-auth";

import { authConfig } from "./lib/auth.config";

// Keep the proxy configuration edge-safe and free of Prisma and bcrypt.
// Detailed authorization remains in requireUser and requireAdmin.
const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  matcher: ["/hesap/:path*", "/admin/:path*"],
};
 