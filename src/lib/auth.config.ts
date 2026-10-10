import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";

import type { SessionUser } from "../server/users/service";

// ---------------------------------------------------------------------------
// Auth.js v5 tip genişletmeleri: oturum ve JWT iddiaları `SessionUser`
// sözleşmesine uyar (session.user.id/role/isBanned tip-güvenli okunur).
// `Session`/`User`/`JWT` asıl bildirimleri @auth/core'dadır; next-auth bunları
// yeniden export ettiği için genişletme tüm tüketicilere ulaşır.
// ---------------------------------------------------------------------------
declare module "@auth/core/types" {
  interface Session {
    user: SessionUser;
  }
  interface User {
    role?: "USER" | "ADMIN";
    isBanned?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: "USER" | "ADMIN";
    isBanned?: boolean;
    emailVerified?: Date | null;
  }
}

type ClaimUser = {
  id?: string | null;
  role?: "USER" | "ADMIN";
  isBanned?: boolean;
};

/**
 * Giriş anında (user varken) id/role/isBanned iddialarını token'a yazar.
 * `role` yalnızca DB'den/seed'den gelir — istemci payload'ı yoktur.
 */
export function applyUserClaims(token: JWT, user: ClaimUser | undefined): JWT {
  if (user) {
    token.id = user.id ?? token.sub;
    token.role = user.role ?? "USER";
    token.isBanned = user.isBanned ?? false;
  }
  return token;
}

/** Token iddialarını oturum nesnesine taşır (name/email core'un koyduğu değerlerdir). */
function withSessionUser(session: Session, token: JWT): Session {
  session.user.id = token.id ?? token.sub ?? "";
  session.user.role = token.role ?? "USER";
  session.user.isBanned = token.isBanned ?? false;
  return session;
}

/**
 * Edge-güvenli taban yapılandırma: prisma/bcrypt içermeyen tek kaynak.
 * `src/middleware.ts` yalnızca bunu import eder; tam yapılandırma
 * (`src/lib/auth.ts`) Credentials + authorize'ı DB ile birlikte ekler.
 *
 * `authorized` yalnızca middleware'de çalışır (coarse ilk kapı):
 * - /hesap/* : oturum yoksa → /giris?callbackUrl=... (false)
 * - /admin/* : oturum yoksa → /giris; ADMIN değilse → /
 * İnce denetim (requireUser/requireAdmin) sayfa/aksiyon katmanındadır.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/giris", error: "/giris" },
  // Google: fonksiyon referansı olarak — clientId/secret AUTH_GOOGLE_ID/
  // AUTH_GOOGLE_SECRET ortam değişkenlerinden Auth.js tarafından doldurulur.
  providers: [Google],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/hesap")) {
        return Boolean(auth?.user);
      }
      if (pathname.startsWith("/admin")) {
        if (!auth?.user) {
          return false;
        }
        if (auth.user.role !== "ADMIN") {
          const homeUrl = request.nextUrl.clone();
          homeUrl.pathname = "/";
          homeUrl.search = "";
          return NextResponse.redirect(homeUrl);
        }
      }
      return true;
    },
    jwt({ token, user }) {
      return applyUserClaims(token, user);
    },
    session({ session, token }) {
      return withSessionUser(session, token);
    },
  },
} satisfies NextAuthConfig;
