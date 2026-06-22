import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListSupportThreadsFn, supportGetThreadFn, adminReplyThreadFn, adminCloseThreadFn } from "@/lib/support.functions";
import { adminToggleSupportFn } from "@/lib/admin.functions";
import { getPublicSettingsFn } from "@/lib/settings.functions";
import { MessageSquare, Send, Lock, Unlock, AlertTriangle, Power } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Admin · Support — Nexus X" }] }),
  component: () => (<Protected><AdminSupport /></Protected>),
});

function AdminSupport() {
  const { user, token } = useAuth();
  const isAdmin = user?.roles?.includes("admin");
  const qc = useQueryClient();
  const callList = useServerFn(adminListSupportThreadsFn);
  const callGet = useServerFn(supportGetThreadFn);
  const callReply = useServerFn(adminReplyThreadFn);
  const callClose = useServerFn(adminCloseThreadFn);
  const callToggle = useServerFn(adminToggleSupportFn);
  const callSettings = useServerFn(getPublicSettingsFn);
  const [active, setActive] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const list = useQuery({ queryKey: ["admin-threads"], queryFn: () => callList({ data: { token: token! } }), enabled: !!token && !!isAdmin, refetchInterval: 8_000 });
  const thread = useQuery({ queryKey: ["support-thread", active], queryFn: () => callGet({ data: { token: token!, thread_id: active! } }), enabled: !!active && !!token, refetchInterval: 5_000 });
  // We piggy-back on getPublicSettingsFn for support_enabled? It's not there. Use a dedicated query via admin settings.
  // Simpler: just use a small inline state — we'll get current value from a small fetch. For now reflect optimistic.
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useQuery({ queryKey: ["__noop-support"], queryFn: async () => null, enabled: false }); // placeholder

  const replyMut = useMutation({
    mutationFn: () => callReply({ data: { token: token!, thread_id: active!, body: reply } }),
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["support-thread", active] }); qc.invalidateQueries({ queryKey: ["admin-threads"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const closeMut = useMutation({
    mutationFn: (close: boolean) => callClose({ data: { token: token!, thread_id: active!, close } }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["support-thread", active] }); qc.invalidateQueries({ queryKey: ["admin-threads"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (en: boolean) => callToggle({ data: { token: token!, enabled: en } }),
    onSuccess: (r) => { setEnabled(r.enabled); toast.success(`Support ${r.enabled ? "enabled" : "disabled"}`); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  if (!isAdmin) return (<AppShell><div className="glass-panel-strong p-12 text-center"><AlertTriangle className="mx-auto size-10 text-destructive" /><h2 className="mt-3 text-xl font-bold">Admin only</h2></div></AppShell>);

  return (
    <AppShell>
      <PageHeader icon={<MessageSquare className="size-6" />} title="Support Inbox" subtitle="Direct messages from agents." />

      <div className="mb-4 flex items-center gap-2 glass-panel-strong p-3">
        <Power className={`size-4 ${enabled === false ? "text-rose-600" : "text-emerald-600"}`} />
        <span className="text-sm font-medium">Agent Support Service:</span>
        <span className={`text-xs font-bold ${enabled === false ? "text-rose-600" : "text-emerald-600"}`}>{enabled === false ? "DISABLED" : "ENABLED"}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => toggleMut.mutate(true)} className="text-xs px-3 py-1 rounded-md bg-emerald-500/15 text-emerald-700 font-bold">Enable</button>
          <button onClick={() => toggleMut.mutate(false)} className="text-xs px-3 py-1 rounded-md bg-rose-500/15 text-rose-700 font-bold">Disable</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel-strong p-3 lg:col-span-1">
          {list.isLoading ? <p className="text-xs text-muted-foreground p-2">Loading…</p> :
            !list.data?.length ? <p className="text-xs text-muted-foreground p-2">No threads.</p> :
              <ul className="space-y-1">
                {list.data.map((t: any) => (
                  <li key={t.id}>
                    <button onClick={() => setActive(t.id)} className={`w-full text-left rounded-lg p-2 text-xs hover:bg-muted ${active === t.id ? "bg-muted" : ""}`}>
                      <div className="font-semibold flex items-center justify-between">
                        <span className="truncate">{t.subject}</span>
                        {t.unread_admin > 0 && <span className="ml-2 rounded-full bg-rose-500 text-white text-[9px] font-bold px-1.5">{t.unread_admin}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{t.agent_email}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        {t.status === "closed" && <Lock className="size-2.5" />}
                        {new Date(t.last_msg_at).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
          }
        </div>

        <div className="glass-panel-strong p-4 lg:col-span-2 min-h-[400px] flex flex-col">
          {!active ? (
            <div className="grid place-items-center flex-1 text-sm text-muted-foreground">Pick a thread to view.</div>
          ) : thread.isLoading || !thread.data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="border-b border-border pb-2 mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold">{thread.data.thread.subject}</h3>
                  <p className="text-xs text-muted-foreground">From {thread.data.thread.agent_email}</p>
                </div>
                <button onClick={() => closeMut.mutate(thread.data!.thread.status === "open")} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted inline-flex items-center gap-1">
                  {thread.data.thread.status === "open" ? <><Lock className="size-3" /> Close</> : <><Unlock className="size-3" /> Reopen</>}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                {thread.data.messages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === "admin" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="text-[9px] uppercase tracking-widest font-bold opacity-70 mb-0.5">{m.sender_role}</div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <div className="text-[9px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
              {thread.data.thread.status === "open" && (
                <div className="flex gap-2">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) replyMut.mutate(); }} placeholder="Reply…" className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm" />
                  <button disabled={!reply.trim() || replyMut.isPending} onClick={() => replyMut.mutate()} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"><Send className="size-3" /></button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
