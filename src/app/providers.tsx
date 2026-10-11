"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

/**
 * Auth.js oturum bağlamını uygulamaya yayar. `SiteHeader` (`useSession`) gibi
 * istemci bileşenleri için zorunludur; aksi hâlde `useSession()` build-time
 * prerender'da `undefined` döner (`TypeError: Cannot destructure property
 * 'data'`). Kök layout bir sunucu bileşeni olduğu için bu sarmalayıcı ayrı bir
 * istemci bileşeni olarak durur.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
