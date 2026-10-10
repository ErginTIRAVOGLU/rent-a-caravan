import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { RequestManager } from "@/components/request-manager";

export const metadata: Metadata = { title: "Taleplerim" };

export default function RequestsPage() {
  return <AccountShell title="Taleplerin" description="Sana gelen ve gönderdiğin talep örneklerini ayrı sekmelerde incele."><RequestManager /></AccountShell>;
}
