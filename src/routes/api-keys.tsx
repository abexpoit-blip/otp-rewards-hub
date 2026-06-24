import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { listApiKeysFn, createApiKeyFn, revokeApiKeyFn } from "@/lib/api-keys.functions";
import { Key, Plus, Copy, Check, BookOpen, Terminal, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/api-keys")({
  head: () => ({ meta: [{ title: "API Keys — Nexus SMS" }] }),
  component: () => (<Protected><ApiKeysPage /></Protected>),
});

function ApiKeysPage() {
  const { token, user } = useAuth();
  const isPrivileged = !!user?.roles?.some((r) => r === "admin" || r === "agent");
  const qc = useQueryClient();
  const callList = useServerFn(listApiKeysFn);
  const callCreate = useServerFn(createApiKeyFn);
  const callRevoke = useServerFn(revokeApiKeyFn);

  const keys = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => callList({ data: { token: token! } }),
    enabled: !!token && !isPrivileged,
  });

  const createMut = useMutation({
    mutationFn: (label: string) => callCreate({ data: { token: token!, label: label || null } }),
    onSuccess: () => { toast.success("API key created"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed to create key"),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => callRevoke({ data: { token: token!, id } }),
    onSuccess: () => { toast.success("API key revoked"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed to revoke key"),
  });

  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState(false);
  const fresh = createMut.data?.key;

  const copyKey = async () => {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <PageHeader icon={<Key className="size-6" />} title="API Keys" subtitle="Generate keys for external bots and integrations." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMut.mutate(label);
          setLabel("");
        }}
        className="glass-panel mb-6 flex flex-wrap items-end gap-3 p-6"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Label (optional)</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Production bot"
            className="w-full rounded-xl border border-input bg-white/70 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
        <button type="submit" disabled={createMut.isPending}
          className="accent-bg inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold accent-glow disabled:opacity-60">
          <Plus className="size-4" />
          {createMut.isPending ? "Generating…" : "Generate key"}
        </button>
      </form>

      {fresh && (
        <div className="glass-panel-strong mb-6 border-2 border-amber-400/40 p-6">
          <p className="mb-2 text-sm font-bold text-amber-700">⚠ Copy this key now — it won't be shown again</p>
          <div className="flex items-center gap-2 rounded-xl bg-foreground p-3 font-mono text-xs text-background">
            <code className="flex-1 break-all">{fresh}</code>
            <button onClick={copyKey} className="rounded-md bg-background/20 p-2">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel p-6">
        <h3 className="mb-4 text-lg font-bold tracking-tight">Active Keys</h3>
        {keys.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : keys.data && keys.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {keys.data.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-3">
                <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{k.key_prefix}…</code>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{k.label || "Unlabeled"}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                {k.revoked_at ? (
                  <span className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-bold uppercase text-destructive">Revoked</span>
                ) : (
                  <button onClick={() => revokeMut.mutate(k.id)}
                    className="rounded-md border border-destructive/30 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        )}
      </div>

      <ApiDocs />
    </AppShell>
  );
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <pre className="overflow-x-auto rounded-xl bg-foreground p-4 pr-12 text-[12px] leading-relaxed text-background font-mono">
        <code>{children}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 rounded-md bg-background/15 p-1.5 text-background/80 hover:bg-background/25 transition"
        title="Copy"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color =
    method === "GET" ? "bg-emerald-500/15 text-emerald-700" :
    method === "POST" ? "bg-blue-500/15 text-blue-700" :
    "bg-amber-500/15 text-amber-700";
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b border-border last:border-b-0">
      <span className={`inline-block w-fit rounded-md px-2 py-0.5 text-[10px] font-bold ${color}`}>{method}</span>
      <code className="font-mono text-xs font-semibold">{path}</code>
      <span className="text-xs text-muted-foreground sm:ml-auto">{desc}</span>
    </div>
  );
}

function ApiDocs() {
  const base = typeof window !== "undefined" ? window.location.origin : "https://your-domain";

  return (
    <div className="glass-panel mt-6 p-6">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="size-5 text-primary" />
        <h3 className="text-lg font-bold tracking-tight">REST API — Bot Integration Guide</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Use these endpoints to let your bot fetch numbers and OTPs <b>from your own account</b>.
        Every request is scoped to the account that owns the API key — your bot cannot access another user's data.
        All responses are JSON, all amounts are in <b>BDT</b>.
      </p>

      {/* Auth */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="size-4 text-primary" />
          <h4 className="font-bold text-sm">1. Authentication</h4>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Generate a key above, copy it once (it is shown only at creation), and send it in the
          <code className="mx-1 px-1 rounded bg-muted text-[11px]">Authorization</code> header on every request:
        </p>
        <CodeBlock>{`Authorization: Bearer nx_your_api_key_here`}</CodeBlock>
        <p className="text-[11px] text-muted-foreground mt-2">
          Keep your key secret. Treat it like a password. Revoke immediately if leaked.
        </p>
      </section>

      {/* Endpoints overview */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="size-4 text-primary" />
          <h4 className="font-bold text-sm">2. Endpoints</h4>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Base URL: <code className="px-1 rounded bg-muted text-[11px] font-mono">{base}</code>
        </p>
        <div className="rounded-xl border border-border p-3 bg-background/50">
          <Endpoint method="GET"  path="/api/v1/balance"        desc="Account balance, lifetime earnings, per-OTP rate" />
          <Endpoint method="POST" path="/api/v1/numbers"        desc="Allocate a new number from a range" />
          <Endpoint method="GET"  path="/api/v1/numbers"        desc="List your recent allocations (filter by status)" />
          <Endpoint method="GET"  path="/api/v1/numbers/{id}"   desc="Allocation status + every OTP received for it" />
          <Endpoint method="GET"  path="/api/v1/inbox"          desc="Recent OTP messages across all numbers" />
        </div>
      </section>

      {/* Typical flow */}
      <section className="mb-6">
        <h4 className="font-bold text-sm mb-2">3. Typical Bot Flow</h4>
        <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1 mb-3">
          <li>Bot authenticates with your API key.</li>
          <li>Bot calls <code className="px-1 rounded bg-muted">POST /api/v1/numbers</code> with a <code className="px-1 rounded bg-muted">range</code> to get a fresh number.</li>
          <li>Bot uses the returned <code className="px-1 rounded bg-muted">number</code> on the target service to request an OTP.</li>
          <li>Bot polls <code className="px-1 rounded bg-muted">GET /api/v1/numbers/{`{id}`}</code> every 3–5 seconds until <code className="px-1 rounded bg-muted">status === "success"</code> and <code className="px-1 rounded bg-muted">otps</code> is non-empty.</li>
          <li>If 20 minutes pass without an OTP, the allocation auto-expires (status becomes <code className="px-1 rounded bg-muted">failed</code>). No balance charge.</li>
        </ol>
      </section>

      {/* Allocate */}
      <section className="mb-6">
        <h4 className="font-bold text-sm mb-2">Example — Allocate a number</h4>
        <CodeBlock>{`curl -X POST '${base}/api/v1/numbers' \\
  -H 'Authorization: Bearer nx_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "range": "8801",
    "sid": "wa",
    "no_plus": false,
    "national": false
  }'`}</CodeBlock>
        <p className="text-[11px] text-muted-foreground mt-2">Response (201):</p>
        <CodeBlock>{`{
  "ok": true,
  "id": "a1b2c3d4-...",
  "number": "+8801XXXXXXXXX",
  "country": "BD",
  "operator": "GP",
  "status": "pending",
  "created_at": "2026-06-22T12:00:00.000Z",
  "expires_at": "2026-06-22T12:20:00.000Z"
}`}</CodeBlock>
      </section>

      {/* Poll OTP */}
      <section className="mb-6">
        <h4 className="font-bold text-sm mb-2">Example — Poll for OTP</h4>
        <CodeBlock>{`curl '${base}/api/v1/numbers/a1b2c3d4-...' \\
  -H 'Authorization: Bearer nx_your_api_key_here'`}</CodeBlock>
        <p className="text-[11px] text-muted-foreground mt-2">Response when OTP arrives:</p>
        <CodeBlock>{`{
  "ok": true,
  "id": "a1b2c3d4-...",
  "number": "+8801XXXXXXXXX",
  "status": "success",
  "payout": 0.60,
  "otps": [
    {
      "id": "f9...",
      "sender": "WhatsApp",
      "body": "Your code is 123-456",
      "received_at": "2026-06-22T12:01:34.000Z"
    }
  ]
}`}</CodeBlock>
      </section>

      {/* Node bot example */}
      <section className="mb-6">
        <h4 className="font-bold text-sm mb-2">Example — Node.js bot loop</h4>
        <CodeBlock>{`const API = '${base}/api/v1';
const KEY = process.env.NEXUS_API_KEY;
const H = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function getNumber(range) {
  const r = await fetch(API + '/numbers', {
    method: 'POST', headers: H,
    body: JSON.stringify({ range })
  });
  if (!r.ok) throw new Error('alloc failed: ' + r.status);
  return r.json();
}

async function waitForOtp(id, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(API + '/numbers/' + id, { headers: H });
    const data = await r.json();
    if (data.status === 'success' && data.otps.length) return data.otps[0];
    if (data.status === 'failed' || data.status === 'expired') throw new Error(data.status);
    await new Promise(res => setTimeout(res, 4000));
  }
  throw new Error('timeout');
}

(async () => {
  const alloc = await getNumber('8801');
  console.log('got number:', alloc.number);
  const otp = await waitForOtp(alloc.id);
  console.log('OTP:', otp.body);
})();`}</CodeBlock>
      </section>

      {/* Errors */}
      <section className="mb-2">
        <h4 className="font-bold text-sm mb-2">4. Error Codes</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li><b className="text-foreground">401</b> — Missing / invalid / revoked API key</li>
          <li><b className="text-foreground">403</b> — Account blocked or pending approval</li>
          <li><b className="text-foreground">404</b> — Allocation does not belong to your account</li>
          <li><b className="text-foreground">409</b> — Out of stock for the requested range</li>
          <li><b className="text-foreground">502</b> — Upstream provider error (try again)</li>
        </ul>
      </section>

      <p className="mt-6 text-[11px] text-muted-foreground border-t border-border pt-3">
        <b>Privacy & isolation:</b> The API key is hashed (SHA-256) before storage; only the prefix is shown after creation.
        Every endpoint enforces <code className="px-1 rounded bg-muted">user_id = your_account_id</code> at the SQL layer —
        bots cannot read or allocate against any other user's account.
      </p>
    </div>
  );
}
