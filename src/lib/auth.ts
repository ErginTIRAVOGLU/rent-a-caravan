import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";

import {
  linkGoogleUser,
  verifyCredentials,
  type SessionUser,
} from "../server/users/service";
import { applyUserClaims, authConfig } from "./auth.config";
import { loginSchema } from "../lib/validators/auth";
import { refreshUserClaims } from "../server/auth/claims";

export type { SessionUser };

/**
 * Tam yapılandırma (Node): taban yapılandırma + Google + Credentials.
 * Middleware bunu DEĞİL, `auth.config.ts`'i import eder (prisma/bcrypt
 * edge paketine sızmaz).
 */
export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null; // geçersiz format → hatalı giriş (Türkçe mesaj UI'da)
        }
        return verifyCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, trigger }) {
      // Google ile giriş: profil DB'ye bağlanır ki `SessionUser.id` her zaman
      // gerçek User.id (cuid) olsun; banlı/çakışan hesapta oturum kurulmaz.
      if (user && account?.provider === "google") {
        const linked = await linkGoogleUser({
          googleId: account.providerAccountId ?? "",
          email: user.email ?? "",
          name: user.name ?? "",
          avatarUrl: user.image ?? null,
        });
        if (!linked.ok) {
          return null; // ban engeli / kimlik çakışması → cookie temizlenir
        }
        token.sub = linked.data.id;
        token.name = linked.data.name;
        token.email = linked.data.email;
        token.id = linked.data.id;
        token.role = linked.data.role;
        token.isBanned = linked.data.isBanned;
        return token;
      }
      // Her sunucu tarafı auth() çağrısında (trigger === undefined veya 'update')
      // kullanıcı iddialarını DB'den yenile.
      if (trigger !== "signIn") {
        const refreshed = await refreshUserClaims(token);
        if (refreshed === null) {
          return null;
        }
        return refreshed;
      }
      // Credentials ilk giriş: id/role/isBanded iddiaları.
      return applyUserClaims(token, user);
    },
  },
});

/**
 * Oturumdaki kullanıcıyı döndürür; oturum yoksa veya ban iddiası taşıyorsa
 * `null`.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.isBanned) {
    return null;
  }
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    role: user.role ?? "USER",
    isBanned: user.isBanned ?? false,
  };
}

/** Oturum yoksa `/giris`'e yönlendirir (server component/aksiyon kapısı). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/giris");
  }
  return user;
}

/** Oturum yoksa `/giris`'e, ADMIN değilse `/`'e yönlendirir. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/");
  }
  return user;
}
