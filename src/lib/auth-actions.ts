"use server";

import { signOut } from "./auth";

/** Header'daki "Çıkış" butonu — çerezi temizler ve ana sayfaya atar. */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
