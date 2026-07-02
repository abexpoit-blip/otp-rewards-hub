import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, Info, Megaphone, Wrench, X, Sparkles } from "lucide-react";
import { listActiveNoticesFn, type NoticeRow } from "@/lib/notices.functions";
import { getPublicSettingsFn } from "@/lib/settings.functions";
import { useAuth } from "@/lib/auth";
import nexusLogo from "@/assets/nexus-logo.png";

const DISMISS_KEY = "nexus_dismissed_notices_v1";
const LAST_POPUP_KEY = "nexus_last_popup_seen_v1";

function readDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}"); } catch { return {}; }
}
function writeDismissed(map: Record<string, number>) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(map)); } catch {}
}

const priorityStyles: Record<NoticeRow["priority"], { bar: string; icon: any; chip: string; ring: string; glow: string }> = {
  info: {
    bar: "from-sky-500/20 via-sky-500/8 to-transparent border-sky-400/50 text-sky-950 dark:text-sky-100",
    icon: Info,
    chip: "bg-sky-500/20 text-sky-800 dark:text-sky-200",
    ring: "ring-sky-400/40",
    glow: "from-sky-500/30 via-cyan-400/20 to-blue-500/30",
  },
  warning: {
    bar: "from-amber-500/20 via-amber-500/8 to-transparent border-amber-400/50 text-amber-950 dark:text-amber-100",
    icon: Megaphone,
    chip: "bg-amber-500/20 text-amber-800 dark:text-amber-200",
    ring: "ring-amber-400/40",
    glow: "from-amber-500/30 via-orange-400/20 to-yellow-500/30",
  },
  critical: {
    bar: "from-rose-500/20 via-rose-500/8 to-transparent border-rose-400/50 text-rose-950 dark:text-rose-100",
    icon: AlertTriangle,
    chip: "bg-rose-500/20 text-rose-800 dark:text-rose-200",
    ring: "ring-rose-400/40",
    glow: "from-rose-500/30 via-pink-400/20 to-red-500/30",
  },
};

export function NoticeBanner({ surface = "user" }: { surface?: "user" | "agent" } = {}) {
  const { token } = useAuth();
  const call = useServerFn(listActiveNoticesFn);
  const callPublic = useServerFn(getPublicSettingsFn);
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => (typeof window !== "undefined" ? readDismissed() : {}));
  const [openPopup, setOpenPopup] = useState<NoticeRow | null>(null);

  const { data: pub } = useQuery({
    queryKey: ["public-settings-banner"],
    queryFn: () => callPublic(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const noticesEnabled = pub?.notices_enabled !== false; // default true

  const { data } = useQuery({
    queryKey: ["active-notices", surface],
    queryFn: () => call({ data: { token: token!, surface } }),
    enabled: !!token && noticesEnabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Show ONLY the latest popup — once per new id
  useEffect(() => {
    if (!noticesEnabled) { setOpenPopup(null); return; }
    if (!data?.length) return;
    const popups = data.filter((n) => n.type === "popup");
    if (!popups.length) return;
    const latest = popups.slice().sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    let lastSeen: string | null = null;
    try { lastSeen = localStorage.getItem(LAST_POPUP_KEY); } catch {}
    if (lastSeen === latest.id) return;
    setOpenPopup(latest);
    try { localStorage.setItem(LAST_POPUP_KEY, latest.id); } catch {}
  }, [data, noticesEnabled]);

  // Lock body scroll while popup open (mobile UX)
  useEffect(() => {
    if (!openPopup) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenPopup(null); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [openPopup]);

  if (!token) return null;

  const banners = noticesEnabled ? (data ?? []).filter((n) => n.type === "banner" && !dismissed[n.id]) : [];
  const showMaintBanner = pub?.maintenance_banner_enabled === true;

  const dismiss = (id: string) => {
    const next = { ...dismissed, [id]: Date.now() };
    setDismissed(next);
    writeDismissed(next);
  };

  return (
    <>
      {showMaintBanner && (
        <div className="mb-3 rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-500/20 px-3 py-2 backdrop-blur-sm shadow-sm flex items-start gap-2.5 text-amber-900">
          <Wrench className="size-4 mt-0.5 shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">Scheduled Maintenance</span>
              <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800">live</span>
            </div>
            <p className="text-xs mt-0.5 opacity-90 whitespace-pre-wrap">
              {pub?.maintenance_message || "We're performing maintenance. Some features may be temporarily unavailable."}
            </p>
          </div>
        </div>
      )}

      {banners.map((n) => {
        const s = priorityStyles[n.priority] ?? priorityStyles.info;
        const Icon = s.icon;
        return (
          <div
            key={n.id}
            className={`relative mb-3 rounded-xl border bg-gradient-to-r ${s.bar} backdrop-blur-sm shadow-sm overflow-hidden`}
          >
            <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${s.glow}`} />
            <div className="flex items-start gap-2.5 px-3 py-2">
              <Icon className="size-4 mt-0.5 shrink-0" />
              {n.image_url && (
                <img src={n.image_url} alt="" className="hidden sm:block h-10 w-10 rounded-md object-cover shrink-0 ring-1 ring-black/10" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{n.title}</span>
                  <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${s.chip}`}>{n.priority}</span>
                </div>
                {n.body && <p className="text-xs mt-0.5 opacity-90 whitespace-pre-wrap">{n.body}</p>}
              </div>
              <button
                onClick={() => dismiss(n.id)}
                className="opacity-70 hover:opacity-100 active:scale-95 transition shrink-0 p-1 rounded-md hover:bg-black/5"
                aria-label="Dismiss notice"
                title="Dismiss"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        );
      })}

      {openPopup && (() => {
        const s = priorityStyles[openPopup.priority] ?? priorityStyles.info;
        const Icon = s.icon;
        return (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={() => setOpenPopup(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-title"
          >
            <div
              className={`relative w-full sm:max-w-lg bg-background/95 backdrop-blur-2xl rounded-t-3xl sm:rounded-3xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.6)] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 sm:slide-in-from-bottom-0 ring-1 ring-white/10 ${s.ring} max-h-[92vh] flex flex-col`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile drag handle */}
              <div className="sm:hidden pt-2 pb-1 flex justify-center shrink-0">
                <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Prominent close button — always tappable, top-right */}
              <button
                onClick={() => setOpenPopup(null)}
                className="absolute top-3 right-3 z-10 h-10 w-10 sm:h-9 sm:w-9 rounded-full bg-background/80 hover:bg-background border border-border/50 shadow-lg backdrop-blur-md flex items-center justify-center active:scale-90 transition-all hover:rotate-90 duration-200"
                aria-label="Close notice"
                title="Close (Esc)"
              >
                <X className="size-5" strokeWidth={2.5} />
              </button>

              {/* Optional hero image */}
              {openPopup.image_url && (
                <div className="relative w-full bg-black/20 shrink-0">
                  <img
                    src={openPopup.image_url}
                    alt=""
                    className="w-full max-h-[45vh] sm:max-h-[320px] object-cover"
                    loading="eager"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className={`absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t ${s.glow} opacity-40 pointer-events-none`} />
                </div>
              )}

              {/* Branded header (only when no image, to keep the popup compact with an image) */}
              {!openPopup.image_url && (
                <div className="relative bg-gradient-to-br from-primary/20 via-chart-2/15 to-chart-3/20 px-6 pt-6 pb-5 border-b border-white/10 shrink-0">
                  <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 50%)" }} />
                  <div className="relative flex items-center gap-3">
                    <img src={nexusLogo} alt="Nexus 2.0" className="h-10 w-auto drop-shadow-lg" />
                    <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] font-bold text-primary/80 px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                      <Sparkles className="size-3" /> Announcement
                    </div>
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`size-11 rounded-2xl flex items-center justify-center shrink-0 ${s.chip} shadow-inner`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[9px] uppercase tracking-widest font-bold ${s.chip} inline-block px-1.5 py-0.5 rounded mb-1`}>{openPopup.priority}</div>
                    <h3 id="notice-title" className="font-bold text-lg sm:text-xl leading-tight">{openPopup.title}</h3>
                  </div>
                </div>
                {openPopup.body && (
                  <p className="text-sm sm:text-[15px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {openPopup.body}
                  </p>
                )}
              </div>

              {/* Actions — sticky-ish footer */}
              <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-t border-border/50 bg-muted/20 shrink-0">
                <button
                  onClick={() => { dismiss(openPopup.id); setOpenPopup(null); }}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-lg hover:bg-muted transition"
                >
                  Don't show again
                </button>
                <button
                  onClick={() => setOpenPopup(null)}
                  className="flex-1 sm:flex-none bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  Got it 🚀
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
