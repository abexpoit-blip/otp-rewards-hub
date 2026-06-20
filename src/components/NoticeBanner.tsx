import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, Info, Megaphone, Wrench, X } from "lucide-react";
import { listActiveNoticesFn, type NoticeRow } from "@/lib/notices.functions";
import { getPublicSettingsFn } from "@/lib/settings.functions";
import { useAuth } from "@/lib/auth";

const DISMISS_KEY = "nexus_dismissed_notices_v1";
const LAST_POPUP_KEY = "nexus_last_popup_seen_v1"; // stores id of last popup shown this device

function readDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}"); } catch { return {}; }
}
function writeDismissed(map: Record<string, number>) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(map)); } catch {}
}

const priorityStyles: Record<NoticeRow["priority"], { bar: string; icon: any; chip: string }> = {
  info:     { bar: "from-sky-500/15 to-sky-500/5 border-sky-400/40 text-sky-900",       icon: Info,           chip: "bg-sky-500/15 text-sky-700" },
  warning:  { bar: "from-amber-500/15 to-amber-500/5 border-amber-400/40 text-amber-900", icon: Megaphone,     chip: "bg-amber-500/15 text-amber-700" },
  critical: { bar: "from-rose-500/15 to-rose-500/5 border-rose-400/40 text-rose-900",   icon: AlertTriangle,  chip: "bg-rose-500/15 text-rose-700" },
};

export function NoticeBanner() {
  const { token } = useAuth();
  const call = useServerFn(listActiveNoticesFn);
  const callPublic = useServerFn(getPublicSettingsFn);
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => (typeof window !== "undefined" ? readDismissed() : {}));
  const [openPopup, setOpenPopup] = useState<NoticeRow | null>(null);

  const { data } = useQuery({
    queryKey: ["active-notices"],
    queryFn: () => call({ data: { token: token! } }),
    enabled: !!token,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: pub } = useQuery({
    queryKey: ["public-settings-banner"],
    queryFn: () => callPublic(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Show ONLY the latest popup (newest created_at) — once per new id
  useEffect(() => {
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
  }, [data]);

  if (!token) return null;

  const banners = (data ?? []).filter((n) => n.type === "banner" && !dismissed[n.id]);
  const showMaintBanner = !!pub?.maintenance_banner_enabled;

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
            className={`mb-3 rounded-xl border bg-gradient-to-r ${s.bar} px-3 py-2 backdrop-blur-sm shadow-sm flex items-start gap-2.5`}
          >
            <Icon className="size-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">{n.title}</span>
                <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${s.chip}`}>{n.priority}</span>
              </div>
              {n.body && <p className="text-xs mt-0.5 opacity-90 whitespace-pre-wrap">{n.body}</p>}
            </div>
            <button
              onClick={() => dismiss(n.id)}
              className="opacity-60 hover:opacity-100 transition shrink-0"
              title="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}

      {openPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setOpenPopup(null)}>
          <div
            className="max-w-md w-full glass-panel-strong rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const s = priorityStyles[openPopup.priority] ?? priorityStyles.info;
              const Icon = s.icon;
              return (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${s.chip}`}><Icon className="size-5" /></div>
                    <div>
                      <div className={`text-[9px] uppercase tracking-widest font-bold ${s.chip} inline-block px-1.5 py-0.5 rounded`}>{openPopup.priority}</div>
                      <h3 className="font-bold text-lg leading-tight">{openPopup.title}</h3>
                    </div>
                  </div>
                  {openPopup.body && <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4">{openPopup.body}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { dismiss(openPopup.id); setOpenPopup(null); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2">Don't show again</button>
                    <button onClick={() => setOpenPopup(null)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-primary/25 hover:bg-primary/90">Got it</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
