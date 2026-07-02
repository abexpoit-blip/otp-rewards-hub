import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { listWithdrawalsFn } from "@/lib/withdrawals.functions";
import { CheckCircle2, X, Sparkles, TrendingUp } from "lucide-react";

const SEEN_KEY = "nx_seen_paid_wds_v1";

type PaidPopup = {
  id: string;
  amount: string;
  gateway: string;
  address: string;
  tx_id: string | null;
  processed_at: string | null;
};

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(s: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s)));
  } catch {
    /* noop */
  }
}

export function PaymentApprovedWatcher() {
  const { token, user } = useAuth();
  const callWds = useServerFn(listWithdrawalsFn);
  const seededRef = useRef(false);
  const [queue, setQueue] = useState<PaidPopup[]>([]);

  const q = useQuery({
    queryKey: ["watcher-withdrawals", user?.id],
    queryFn: () => callWds({ data: { token: token! } }),
    enabled: !!token && !!user,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!q.data) return;
    const paid = q.data.filter((w) => w.status === "paid");
    const seen = loadSeen();

    // First load ever — seed and skip popups for existing paid rows.
    if (!seededRef.current) {
      seededRef.current = true;
      for (const w of paid) seen.add(w.id);
      saveSeen(seen);
      return;
    }

    const fresh = paid.filter((w) => !seen.has(w.id));
    if (fresh.length === 0) return;

    for (const w of fresh) seen.add(w.id);
    saveSeen(seen);

    setQueue((prev) => [
      ...prev,
      ...fresh.map((w) => ({
        id: w.id,
        amount: w.amount,
        gateway: w.gateway,
        address: w.address,
        tx_id: w.tx_id,
        processed_at: w.processed_at,
      })),
    ]);
  }, [q.data]);

  // Reset on user change
  useEffect(() => {
    seededRef.current = false;
    setQueue([]);
  }, [user?.id]);

  if (queue.length === 0) return null;
  const current = queue[0];
  const close = () => setQueue((prev) => prev.slice(1));

  return <PaymentApprovedModal payment={current} onClose={close} />;
}

function PaymentApprovedModal({
  payment,
  onClose,
}: {
  payment: PaidPopup;
  onClose: () => void;
}) {
  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const amt = Number(payment.amount).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-approved-title"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b0b1e] via-[#131038] to-[#1a0f3d] shadow-[0_25px_80px_-15px_rgba(99,102,241,0.55)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* glow accents */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-violet-400/20 blur-3xl" />

        {/* close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/5 text-white/70 backdrop-blur-sm ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white"
        >
          <X className="size-4" />
        </button>

        <div className="relative px-6 pt-8 pb-6 text-center">
          {/* success emblem */}
          <div className="mx-auto mb-4 grid size-20 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_45px_-5px_rgba(16,185,129,0.75)] ring-4 ring-emerald-400/20">
            <CheckCircle2 className="size-11 text-white" strokeWidth={2.5} />
          </div>

          {/* Brand tag */}
          <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
            <Sparkles className="size-3" />
            Nexus X V 2.0
          </div>

          <h2
            id="payment-approved-title"
            className="text-2xl font-black tracking-tight text-white sm:text-3xl"
          >
            Payment Sent Successfully
          </h2>
          <p className="mt-1 text-xs text-white/60">
            আপনার withdrawal admin কর্তৃক approve ও send করা হয়েছে ✅
          </p>

          {/* Amount */}
          <div className="mx-auto mt-6 max-w-xs rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
              Amount Sent
            </p>
            <p className="mt-1 bg-gradient-to-r from-emerald-300 via-emerald-200 to-lime-200 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
              ৳{amt}
            </p>
            <p className="mt-1 text-[11px] font-mono text-white/60">
              via <span className="font-bold text-white/90">{payment.gateway}</span>
            </p>
          </div>

          {/* Meta rows */}
          <div className="mt-4 space-y-1.5 text-left text-[11px] font-mono text-white/70">
            <MetaRow label="To" value={payment.address} mono />
            {payment.tx_id && <MetaRow label="TX" value={payment.tx_id} mono />}
            {payment.processed_at && (
              <MetaRow
                label="Time"
                value={new Date(payment.processed_at).toLocaleString()}
              />
            )}
          </div>

          {/* CTA copy */}
          <div className="mt-6 rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 px-4 py-3 text-left">
            <div className="flex items-start gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-lg">
                <TrendingUp className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  Push traffic to get payment continue
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/60">
                  আরও OTP deliver করুন — daily payment continue রাখতে regular
                  traffic push করে যান 🚀
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(139,92,246,0.7)] transition hover:brightness-110 active:scale-[0.98]"
          >
            Continue
          </button>

          <p className="mt-3 text-[10px] uppercase tracking-widest text-white/40">
            Thank you for being with Nexus X ❤️
          </p>
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-right text-[11px] ${
          mono ? "font-mono" : ""
        } text-white/85`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
