import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { agentChangeTempPasswordFn } from "@/lib/agent.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, ShieldCheck } from "lucide-react";

/**
 * Blocking overlay shown to agents whose password was set by an admin.
 * They must replace the temporary password before doing anything else.
 */
export function TempPasswordModal({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const callChange = useServerFn(agentChangeTempPasswordFn);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);

  const m = useMutation({
    mutationFn: async () =>
      callChange({ data: { token: token!, new_password: pw } }),
    onSuccess: async () => {
      toast.success("Password updated — welcome aboard!");
      await qc.invalidateQueries({ queryKey: ["agent-profile"] });
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update password"),
  });

  const lenOk = pw.length >= 8;
  const matchOk = pw.length > 0 && pw === pw2;
  const mixOk = /[a-z]/i.test(pw) && /\d/.test(pw);
  const canSubmit = lenOk && matchOk && mixOk && !m.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    m.mutate();
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-md p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-lg shadow-amber-500/30">
            <KeyRound className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Set your password</h2>
            <p className="text-xs text-muted-foreground">
              Admin gave you a temporary password. Choose your own to continue.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">New password</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 p-1 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Confirm password</label>
            <input
              type={show ? "text" : "password"}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Re-type new password"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <ul className="mt-2 space-y-1 text-xs">
            <Hint ok={lenOk}>At least 8 characters</Hint>
            <Hint ok={mixOk}>Contains a letter and a number</Hint>
            <Hint ok={matchOk}>Both fields match</Hint>
          </ul>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-95 disabled:opacity-50"
        >
          <ShieldCheck className="size-4" />
          {m.isPending ? "Saving…" : "Save new password"}
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          From your next login, use your email with this new password.
        </p>
      </form>
    </div>
  );
}

function Hint({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-emerald-500" : "text-muted-foreground"}`}>
      <span className={`inline-block size-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
      {children}
    </li>
  );
}
