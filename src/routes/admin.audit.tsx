import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListAuditFn } from "@/lib/notices.functions";
import { Activity, Search, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Admin · Audit Log — Nexus SMS" }] }),
  component: () => (<Protected><AdminAudit /></Protected>),
});

function AdminAudit() {
  const { user, token } = useAuth();
  const isAdmin = user?.roles?.includes("admin");
  const call = useServerFn(adminListAuditFn);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", search],
    queryFn: () => call({ data: { token: token!, search, limit: 200 } }),
    enabled: !!token && isAdmin,
    refetchInterval: 15_000,
  });

  if (!isAdmin) return (<AppShell><div className="glass-panel-strong p-12 text-center"><AlertTriangle className="mx-auto size-10 text-destructive" /><h2 className="mt-3 text-xl font-bold">Admin only</h2></div></AppShell>);

  const actionColor = (a: string) => {
    if (a.includes("block") || a.includes("revoke") || a.includes("delete") || a.includes("force_logout") || a.includes("suspend")) return "text-rose-700 bg-rose-500/10";
    if (a.includes("credit") || a.includes("grant") || a.includes("approve") || a.includes("unblock") || a.includes("unsuspend")) return "text-emerald-700 bg-emerald-500/10";
    if (a.includes("update") || a.includes("create") || a.includes("set")) return "text-sky-700 bg-sky-500/10";
    return "text-muted-foreground bg-muted";
  };

  return (
    <AppShell>
      <PageHeader icon={<Activity className="size-6" />} title="Audit Log" subtitle="Every admin action tracked here." />

      <div className="glass-panel-strong p-3 mb-4 flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by action, admin email, target id…" className="flex-1 bg-transparent text-sm outline-none" />
      </div>

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Admin</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Target</th>
              <th className="text-left p-3">Meta</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading…</td></tr> :
              (data ?? []).length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No audit entries.</td></tr> :
              data!.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="p-3 font-mono text-xs whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="p-3 text-xs">{row.actor_email || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3"><span className={`inline-block text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${actionColor(row.action)}`}>{row.action}</span></td>
                  <td className="p-3 text-xs">
                    {row.target_type && <div className="font-semibold">{row.target_type}</div>}
                    {row.target_id && <div className="font-mono text-muted-foreground truncate max-w-[200px]">{row.target_id}</div>}
                  </td>
                  <td className="p-3 text-xs font-mono text-muted-foreground max-w-md break-words">{Object.keys(row.meta || {}).length ? JSON.stringify(row.meta) : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
