import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AgentProtected } from "@/components/AgentProtected";
import { useAuth } from "@/lib/auth";
import { agentListThreadsFn, agentCreateThreadFn, agentSendMessageFn, supportGetThreadFn } from "@/lib/support.functions";
import { MessageSquare, Plus, Send, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agent/support")({
  head: () => ({ meta: [{ title: "Agent · Support — Nexus X" }] }),
  component: () => (<AgentProtected><AgentSupport /></AgentProtected>),
});

function AgentSupport() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const callList = useServerFn(agentListThreadsFn);
  const callCreate = useServerFn(agentCreateThreadFn);
  const callSend = useServerFn(agentSendMessageFn);
  const callGet = useServerFn(supportGetThreadFn);
  const [active, setActive] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");

  const list = useQuery({
    queryKey: ["agent-threads"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token, refetchInterval: 10_000,
  });

  const thread = useQuery({
    queryKey: ["support-thread", active],
    queryFn: () => callGet({ data: { token: token!, thread_id: active! } }),
    enabled: !!active && !!token, refetchInterval: 5_000,
  });

  const create = useMutation({
    mutationFn: () => callCreate({ data: { token: token!, subject, body } }),
    onSuccess: (r) => { toast.success("Sent"); setActive(r.id); setComposing(false); setSubject(""); setBody(""); qc.invalidateQueries({ queryKey: ["agent-threads"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const send = useMutation({
    mutationFn: () => callSend({ data: { token: token!, thread_id: active!, body: reply } }),
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["support-thread", active] }); qc.invalidateQueries({ queryKey: ["agent-threads"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  return (
    <AppShell>
      <PageHeader icon={<MessageSquare className="size-6" />} title="Support Inbox" subtitle="Direct line to admin. Users cannot see this." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel-strong p-3 lg:col-span-1">
          <button onClick={() => { setComposing(true); setActive(null); }} className="w-full bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs font-bold mb-3 inline-flex items-center justify-center gap-1.5"><Plus className="size-3.5" /> New thread</button>
          {list.isLoading ? <p className="text-xs text-muted-foreground p-2">Loading…</p> :
            !list.data?.length ? <p className="text-xs text-muted-foreground p-2">No threads yet.</p> :
              <ul className="space-y-1">
                {list.data.map((t: any) => (
                  <li key={t.id}>
                    <button onClick={() => { setActive(t.id); setComposing(false); }} className={`w-full text-left rounded-lg p-2 text-xs hover:bg-muted ${active === t.id ? "bg-muted" : ""}`}>
                      <div className="font-semibold flex items-center justify-between">
                        <span className="truncate">{t.subject}</span>
                        {t.unread_agent > 0 && <span className="ml-2 rounded-full bg-rose-500 text-white text-[9px] font-bold px-1.5">{t.unread_agent}</span>}
                      </div>
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
          {composing ? (
            <>
              <h3 className="font-bold mb-3">New message to admin</h3>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-2" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message…" rows={6} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-3" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setComposing(false)} className="px-3 py-2 text-xs hover:bg-accent rounded-lg">Cancel</button>
                <button disabled={!subject.trim() || !body.trim() || create.isPending} onClick={() => create.mutate()} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"><Send className="size-3" /> Send</button>
              </div>
            </>
          ) : !active ? (
            <div className="grid place-items-center flex-1 text-sm text-muted-foreground">Pick a thread or start a new one.</div>
          ) : thread.isLoading || !thread.data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <h3 className="font-bold border-b border-border pb-2 mb-3 flex items-center justify-between">
                <span>{thread.data.thread.subject}</span>
                {thread.data.thread.status === "closed" && <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground inline-flex items-center gap-1"><Lock className="size-3" /> Closed</span>}
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                {thread.data.messages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.sender_role === "agent" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === "agent" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="text-[9px] uppercase tracking-widest font-bold opacity-70 mb-0.5">{m.sender_role}</div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <div className="text-[9px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
              {thread.data.thread.status === "open" && (
                <div className="flex gap-2">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) send.mutate(); }} placeholder="Reply to admin…" className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm" />
                  <button disabled={!reply.trim() || send.isPending} onClick={() => send.mutate()} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"><Send className="size-3" /></button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
