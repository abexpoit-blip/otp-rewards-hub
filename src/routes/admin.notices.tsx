import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import {
  adminListNoticesFn, adminUpsertNoticeFn, adminDeleteNoticeFn, type NoticeRow,
} from "@/lib/notices.functions";
import { adminSetSettingFn } from "@/lib/admin.functions";
import { getPublicSettingsFn } from "@/lib/settings.functions";
import { Radio, Plus, Pencil, Trash2, AlertTriangle, Info, Megaphone, Check, X, Power, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/notices")({
  head: () => ({ meta: [{ title: "Admin · Notices — Nexus SMS" }] }),
  component: () => (<Protected><AdminNotices /></Protected>),
});

type EditState = Partial<NoticeRow> & { _editing: boolean; _targetEmailsText?: string; _targetMode?: "all" | "custom" };

const empty: EditState = {
  _editing: true,
  type: "banner",
  priority: "info",
  audience: "user",
  title: "",
  body: "",
  image_url: "",
  active: true,
  starts_at: null,
  ends_at: null,
  _targetMode: "all",
  _targetEmailsText: "",
};

function AdminNotices() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.roles?.includes("admin");
  const callList = useServerFn(adminListNoticesFn);
  const callUpsert = useServerFn(adminUpsertNoticeFn);
  const callDelete = useServerFn(adminDeleteNoticeFn);
  const callSetSetting = useServerFn(adminSetSettingFn);
  const callPublic = useServerFn(getPublicSettingsFn);

  const [edit, setEdit] = useState<EditState | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-notices"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token && isAdmin,
  });

  const pub = useQuery({
    queryKey: ["public-settings-admin-notices"],
    queryFn: () => callPublic(),
    enabled: !!isAdmin,
    refetchInterval: 30_000,
  });
  const noticesEnabled = pub.data?.notices_enabled !== false;

  const toggleSystem = useMutation({
    mutationFn: (next: boolean) => callSetSetting({ data: { token: token!, key: "notices_enabled", value: next } }),
    onSuccess: (_r, next) => {
      toast.success(next ? "Notice system enabled" : "Notice system paused — all users hidden");
      qc.invalidateQueries({ queryKey: ["public-settings-admin-notices"] });
      qc.invalidateQueries({ queryKey: ["public-settings-banner"] });
      qc.invalidateQueries({ queryKey: ["active-notices"] });
    },
    onError: (e: any) => toast.error(e?.message || "Toggle failed"),
  });

  const upsert = useMutation({
    mutationFn: (v: any) => callUpsert({ data: { token: token!, ...v } }),
    onSuccess: (r: any) => {
      toast.success(r?.matched_users ? `Notice saved · ${r.matched_users} user(s) targeted` : "Notice saved · all users");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["admin-notices"] });
      qc.invalidateQueries({ queryKey: ["active-notices"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => callDelete({ data: { token: token!, id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-notices"] }); qc.invalidateQueries({ queryKey: ["active-notices"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  if (!isAdmin) return (<AppShell><div className="glass-panel-strong p-12 text-center"><AlertTriangle className="mx-auto size-10 text-destructive" /><h2 className="mt-3 text-xl font-bold">Admin only</h2></div></AppShell>);

  return (
    <AppShell>
      <PageHeader icon={<Radio className="size-6" />} title="Notices" subtitle="Site-wide banner & popup announcements — with images." />

      {/* Master system toggle */}
      <div className={`mb-4 rounded-2xl border p-4 flex items-center gap-4 shadow-sm transition-all ${noticesEnabled ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent" : "border-rose-500/40 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent"}`}>
        <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${noticesEnabled ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/20 text-rose-700 dark:text-rose-300"}`}>
          <Power className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">Notice System — Master Switch</div>
          <div className="text-xs text-muted-foreground">
            {noticesEnabled ? "Live. All active notices are being shown to users & agents." : "Paused. Users and agents will not see any notice, banner or popup."}
          </div>
        </div>
        <button
          onClick={() => toggleSystem.mutate(!noticesEnabled)}
          disabled={toggleSystem.isPending || pub.isLoading}
          className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${noticesEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
          aria-label="Toggle notice system"
        >
          <span className={`inline-block h-6 w-6 rounded-full bg-white shadow-lg transform transition-transform mt-1 ${noticesEnabled ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </div>

      <div className="mb-4 flex justify-end">
        <button onClick={() => setEdit({ ...empty })} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary/90">
          <Plus className="size-3.5" /> New Notice
        </button>
      </div>

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Active</th>
              <th className="text-left p-3">Image</th>
              <th className="text-left p-3">Audience</th>
              <th className="text-left p-3">Window</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr> :
              (data ?? []).length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No notices yet.</td></tr> :
              data!.map((n) => {
                const Icon = n.priority === "critical" ? AlertTriangle : n.priority === "warning" ? Megaphone : Info;
                const isAll = !n.target_user_ids || n.target_user_ids.length === 0;
                return (
                  <tr key={n.id} className="border-t border-border">
                    <td className="p-3"><div className="font-semibold">{n.title}</div>{n.body && <div className="text-xs text-muted-foreground line-clamp-1 max-w-md">{n.body}</div>}</td>
                    <td className="p-3"><span className="text-[10px] uppercase font-bold tracking-widest">{n.type}</span></td>
                    <td className="p-3"><span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest"><Icon className="size-3" /> {n.priority}</span></td>
                    <td className="p-3">{n.active ? <Check className="size-4 text-emerald-600" /> : <X className="size-4 text-muted-foreground" />}</td>
                    <td className="p-3">
                      {n.image_url ? (
                        <img src={n.image_url} alt="" className="h-8 w-14 rounded object-cover ring-1 ring-border" />
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-xs">
                      {isAll ? <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 font-bold uppercase text-[10px]">All</span> :
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 font-bold text-[10px]" title={(n.target_emails ?? []).join(", ")}>{n.target_user_ids!.length} user{n.target_user_ids!.length > 1 ? "s" : ""}</span>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground font-mono">
                      {n.starts_at ? new Date(n.starts_at).toLocaleDateString() : "—"} → {n.ends_at ? new Date(n.ends_at).toLocaleDateString() : "∞"}
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => setEdit({ ...n, _editing: true, _targetMode: isAll ? "all" : "custom", _targetEmailsText: (n.target_emails ?? []).join(", ") })} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-muted mr-1"><Pencil className="size-3" /> Edit</button>
                      <button onClick={() => { if (confirm("Delete this notice?")) del.mutate(n.id); }} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="size-3" /></button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEdit(null)}>
          <div className="max-w-lg w-full glass-panel-strong rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">{edit.id ? "Edit Notice" : "New Notice"}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs"><span className="font-bold mb-1 block">Type</span>
                  <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as any })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm">
                    <option value="banner">Banner (top of page)</option>
                    <option value="popup">Popup (modal once)</option>
                  </select>
                </label>
                <label className="block text-xs"><span className="font-bold mb-1 block">Priority</span>
                  <select value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value as any })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm">
                    <option value="info">Info (blue)</option>
                    <option value="warning">Warning (amber)</option>
                    <option value="critical">Critical (red)</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs"><span className="font-bold mb-1 block">Audience</span>
                <select value={edit.audience || "user"} onChange={(e) => setEdit({ ...edit, audience: e.target.value as any })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm">
                  <option value="user">Users only</option>
                  <option value="agent">Agents only</option>
                  <option value="both">Both users and agents</option>
                </select>
              </label>
              <label className="block text-xs"><span className="font-bold mb-1 block">Title</span>
                <input value={edit.title || ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs"><span className="font-bold mb-1 block">Body (optional)</span>
                <textarea rows={4} value={edit.body || ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
              </label>

              {/* Image URL */}
              <label className="block text-xs">
                <span className="font-bold mb-1 flex items-center gap-1.5"><ImageIcon className="size-3.5" /> Image URL (optional)</span>
                <input
                  type="url"
                  value={edit.image_url || ""}
                  onChange={(e) => setEdit({ ...edit, image_url: e.target.value })}
                  placeholder="https://v2.nexus-x.site/banners/rate.png"
                  className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Recommended 1200x600 for popups, 400x120 for banners. Paste any public https URL (Telegram CDN, imgbb, own domain).</p>
                {edit.image_url && (
                  <div className="mt-2 rounded-lg border border-border overflow-hidden bg-muted/20">
                    <img src={edit.image_url} alt="preview" className="w-full max-h-40 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }} />
                  </div>
                )}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs"><span className="font-bold mb-1 block">Starts (optional)</span>
                  <input type="datetime-local" value={edit.starts_at ? edit.starts_at.slice(0,16) : ""} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
                </label>
                <label className="block text-xs"><span className="font-bold mb-1 block">Ends (optional)</span>
                  <input type="datetime-local" value={edit.ends_at ? edit.ends_at.slice(0,16) : ""} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>

              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <div className="text-xs font-bold uppercase tracking-wider mb-2">Audience</div>
                <div className="flex gap-3 mb-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" checked={(edit._targetMode ?? "all") === "all"} onChange={() => setEdit({ ...edit, _targetMode: "all" })} /> All users
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" checked={edit._targetMode === "custom"} onChange={() => setEdit({ ...edit, _targetMode: "custom" })} /> Custom users (by email)
                  </label>
                </div>
                {edit._targetMode === "custom" && (
                  <textarea
                    rows={3}
                    value={edit._targetEmailsText || ""}
                    onChange={(e) => setEdit({ ...edit, _targetEmailsText: e.target.value })}
                    placeholder="alice@example.com, bob@example.com"
                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono"
                  />
                )}
                {edit._targetMode === "custom" && (
                  <p className="text-[10px] text-muted-foreground mt-1">Comma or newline separated. Unknown emails cause the save to fail.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEdit(null)} className="text-xs font-semibold px-3 py-2 text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={() => {
                  const emails = (edit._targetMode === "custom")
                    ? (edit._targetEmailsText || "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
                    : [];
                  upsert.mutate({
                    id: edit.id ?? undefined,
                    type: edit.type, priority: edit.priority,
                    audience: (edit.audience || "user"),
                    title: (edit.title || "").trim(),
                    body: edit.body || "",
                    image_url: (edit.image_url || "").trim() || null,
                    active: !!edit.active,
                    starts_at: edit.starts_at ?? undefined,
                    ends_at: edit.ends_at ?? undefined,
                    target_emails: emails,
                  });
                }}
                disabled={!edit.title?.trim() || upsert.isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary/90 disabled:opacity-50"
              >{upsert.isPending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
