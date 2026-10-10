"use client";

import { useState } from "react";
import { Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";

type UserRow = { id: number; name: string; email: string; joined: string; status: "Aktif" | "Engellendi" };
const initialUsers: UserRow[] = [
  { id: 1, name: "Ada Yıldız", email: "ada@ornek.demo", joined: "04 Haziran 2026", status: "Aktif" },
  { id: 2, name: "Baran Akın", email: "baran@ornek.demo", joined: "18 Mayıs 2026", status: "Aktif" },
  { id: 3, name: "Mina Kılıç", email: "mina@ornek.demo", joined: "02 Mayıs 2026", status: "Engellendi" },
  { id: 4, name: "Deniz Yılmaz", email: "deniz@ornek.demo", joined: "24 Nisan 2026", status: "Aktif" },
];

export function AdminUserManager() {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<UserRow | null>(null);
  const [notice, setNotice] = useState("");
  const filtered = users.filter((user) => `${user.name} ${user.email}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  function toggleStatus() {
    if (!pending) return;
    const next = pending.status === "Aktif" ? "Engellendi" : "Aktif";
    setUsers((current) => current.map((user) => user.id === pending.id ? { ...user, status: next } : user));
    setNotice(`${pending.name} adlı örnek kullanıcının durumu ${next.toLocaleLowerCase("tr-TR")} olarak güncellendi. Gerçek kullanıcı etkilenmedi.`);
    setPending(null);
  }
  const statusBadge = (user: UserRow) => <Badge tone={user.status === "Aktif" ? "success" : "error"}>{user.status}</Badge>;
  const action = (user: UserRow) => <button type="button" onClick={() => setPending(user)} className={`min-h-11 rounded-full px-3 text-xs font-bold ${user.status === "Aktif" ? "text-error hover:bg-error-soft" : "text-forest hover:bg-sage-pale"}`}>{user.status === "Aktif" ? "Engelle" : "Engeli kaldır"}</button>;
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ink-muted">Örnek kullanıcı kayıtları · gerçek hesap verisi yok</p><label className="relative w-full max-w-xs"><Search size={16} className="absolute left-3 top-3.5 text-ink-faint" /><input className="min-h-11 w-full rounded-full border border-line bg-white pl-9 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad veya e-posta ara" aria-label="Ad veya e-posta ara" /></label></div>
    {notice ? <p className="mb-4 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info" role="status">{notice}</p> : null}
    <div className="hidden overflow-hidden rounded-3xl border border-line bg-white md:block"><table className="w-full border-collapse text-left"><thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted"><tr><th scope="col" className="px-5 py-4">Kullanıcı</th><th scope="col" className="px-4 py-4">Kayıt tarihi</th><th scope="col" className="px-4 py-4">Durum</th><th scope="col" className="px-4 py-4 text-right">İşlem</th></tr></thead><tbody className="divide-y divide-line">{filtered.map((user) => <tr key={user.id}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-sage-pale text-forest"><UserRound size={17} /></span><span><span className="block text-sm font-bold text-ink">{user.name}</span><span className="mt-0.5 block text-xs text-ink-muted">{user.email}</span></span></div></td><td className="px-4 py-4 text-sm text-ink-muted">{user.joined}</td><td className="px-4 py-4">{statusBadge(user)}</td><td className="px-4 py-4 text-right">{action(user)}</td></tr>)}</tbody></table></div>
    <div className="grid gap-3 md:hidden">{filtered.map((user) => <article key={user.id} className="rounded-2xl border border-line bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-ink">{user.name}</h2><p className="mt-1 text-xs text-ink-muted">{user.email}</p></div>{statusBadge(user)}</div><div className="mt-3 flex items-center justify-between border-t border-line pt-3"><span className="text-xs text-ink-muted">Kayıt: {user.joined}</span>{action(user)}</div></article>)}</div>
    {!filtered.length ? <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-ink-muted">Aramana uygun örnek kullanıcı yok.</div> : null}
    <ConfirmDialog open={Boolean(pending)} title={`${pending?.status === "Aktif" ? "Kullanıcıyı engelle" : "Engeli kaldır"}?`} description={`${pending?.name ?? "Örnek kullanıcı"} için bu değişiklik yalnızca demo tablosunda görünür; gerçek hesap erişimi değişmez.`} confirmLabel="Demo değişikliğini uygula" destructive={pending?.status === "Aktif"} onCancel={() => setPending(null)} onConfirm={toggleStatus} />
  </div>;
}
