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
import { Radio, Plus, Pencil, Trash2, AlertTriangle, Info, Megaphone, Check, X } from "lucide-react";
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
  title: "",
  body: "",
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

  const [edit, setEdit] = useState<EditState | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-notices"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token && isAdmin,
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
      <PageHeader icon={<Radio className="size-6" />} title="Notices" subtitle="Site-wide banner & popup announcements." />

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
              <th className="text-left p-3">Audience</th>
              <th className="text-left p-3">Window</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr> :
              (data ?? []).length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No notices yet.</td></tr> :
              data!.map((n) => {
                const Icon = n.priority === "critical" ? AlertTriangle : n.priority === "warning" ? Megaphone : Info;
                const isAll = !n.target_user_ids || n.target_user_ids.length === 0;
                return (
                  <tr key={n.id} className="border-t border-border">
                    <td className="p-3"><div className="font-semibold">{n.title}</div>{n.body && <div className="text-xs text-muted-foreground line-clamp-1 max-w-md">{n.body}</div>}</td>
                    <td className="p-3"><span className="text-[10px] uppercase font-bold tracking-widest">{n.type}</span></td>
                    <td className="p-3"><span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest"><Icon className="size-3" /> {n.priority}</span></td>
                    <td className="p-3">{n.active ? <Check className="size-4 text-emerald-600" /> : <X className="size-4 text-muted-foreground" />}</td>
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
          <div className="max-w-lg w-full glass-panel-strong rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
              <label className="block text-xs"><span className="font-bold mb-1 block">Title</span>
                <input value={edit.title || ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs"><span className="font-bold mb-1 block">Body (optional)</span>
                <textarea rows={4} value={edit.body || ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
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
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEdit(null)} className="text-xs font-semibold px-3 py-2 text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={() => upsert.mutate({
                  id: edit.id ?? undefined,
                  type: edit.type, priority: edit.priority,
                  title: (edit.title || "").trim(),
                  body: edit.body || "",
                  active: !!edit.active,
                  starts_at: edit.starts_at ?? undefined,
                  ends_at: edit.ends_at ?? undefined,
                })}
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
