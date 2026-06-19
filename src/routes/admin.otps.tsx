import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { adminListOtpsFn } from "@/lib/admin.functions";
import { MessageSquare, Search, RefreshCw, AlertTriangle, Calendar, X } from "lucide-react";
import { Pager } from "@/components/Pager";

const otpSearch = z.object({
  range: fallback(z.enum(["all", "today", "7d", "30d"]), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int().min(1), 1).default(1),
  pageSize: fallback(z.enum(["25", "50", "100", "200"]), "50").default("50"),
});

export const Route = createFileRoute("/admin/otps")({
  validateSearch: zodValidator(otpSearch),
  head: () => ({ meta: [{ title: "Admin · OTPs Received — Nexus X" }] }),
  component: () => (<Protected><AdminOtps /></Protected>),
});

function AdminOtps() {
  const { user, token } = useAuth();
  const navigate = useNavigate({ from: "/admin/otps" });
  const search = Route.useSearch();
  const { range, q: searchQ, page, pageSize } = search;
  const limit = Number(pageSize);
  const offset = (page - 1) * limit;
  const [searchInput, setSearchInput] = useState(searchQ);
  useEffect(() => { setSearchInput(searchQ); }, [searchQ]);

  const callList = useServerFn(adminListOtpsFn);
  const isAdmin = !!user?.roles?.includes("admin");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-otps", range, searchQ, page, pageSize],
    queryFn: () => callList({ data: { token: token!, range, search: searchQ, limit, offset } }),
    enabled: !!token && isAdmin,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const setSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (prev: typeof search) => {
      const filterChanged = ("range" in patch) || ("q" in patch) || ("pageSize" in patch);
      const next = { ...prev, ...patch };
      if (filterChanged && !("page" in patch)) next.page = 1;
      return next;
    }});

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="glass-panel-strong p-12 text-center">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h2 className="mt-3 text-xl font-bold">Admin only</h2>
        </div>
      </AppShell>
    );
  }

  const ranges: Array<{ key: typeof range; label: string }> = [
    { key: "today", label: "Today" },
    { key: "7d",    label: "7 days" },
    { key: "30d",   label: "30 days" },
    { key: "all",   label: "All time" },
  ];

  return (
    <AppShell>
      <PageHeader
        icon={<MessageSquare className="size-6" />}
        title="OTPs Received"
        subtitle="Every SMS delivered from STEX into a user inbox. Filter by date, user, sender or message body."
      />

      <div className="glass-panel-strong mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
          <Calendar className="ml-1.5 size-3.5 text-muted-foreground" />
          {ranges.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSearch({ range: key })}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                range === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch({ q: searchInput.trim() }); }}
          className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 min-w-[240px]"
        >
          <Search className="size-4 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email, number, sender or text…  (press Enter)"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {searchQ && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); setSearch({ q: "" }); }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          )}
        </form>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="glass-panel-strong mb-4 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      )}

      <div className="glass-panel-strong overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Received</th>
              <th className="p-3 text-left">Number</th>
              <th className="p-3 text-left">Sender</th>
              <th className="p-3 text-left">Message</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Country</th>
              <th className="p-3 text-right">Allocation</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : !data || data.rows.length === 0 ? (
              <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No OTP messages match this filter.</td></tr>
            ) : data.rows.map((o) => (
              <tr key={o.id} className="border-t border-border/40 transition-colors hover:bg-muted/30 align-top">
                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(o.received_at).toLocaleString()}
                </td>
                <td className="p-3 font-mono text-xs">{o.number || "—"}</td>
                <td className="p-3 text-xs">{o.sender || "—"}</td>
                <td className="p-3 max-w-[420px] text-xs">
                  <div className="line-clamp-3 whitespace-pre-wrap break-words">{o.body}</div>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {o.user_email ? (
                    <button onClick={() => setSearch({ q: o.user_email! })} className="hover:underline" title="Filter by this user">
                      {o.user_email}
                    </button>
                  ) : "—"}
                </td>
                <td className="p-3 text-xs">{o.country || "—"}{o.carrier ? <span className="text-muted-foreground"> · {o.carrier}</span> : ""}</td>
                <td className="p-3 text-right text-[11px]">
                  {o.allocation_id ? (
                    <Link
                      to="/admin/allocations"
                      search={{ status: "all", range: "all", q: o.number ?? "", page: 1, pageSize: "50" }}
                      className="text-primary hover:underline"
                    >
                      view →
                    </Link>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && (
          <Pager
            page={page}
            pageSize={limit}
            total={data.total}
            shown={data.rows.length}
            onPage={(p) => setSearch({ page: p })}
            onPageSize={(s) => setSearch({ pageSize: s as any, page: 1 })}
          />
        )}
      </div>
    </AppShell>
  );
}
