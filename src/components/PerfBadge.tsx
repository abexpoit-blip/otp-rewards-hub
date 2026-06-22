export type PerfTier = {
  key: "none" | "silver" | "gold" | "diamond" | "superstar";
  label: string;
  min: number;
  next?: number;
  className: string; // pill background+text+border
  glow: string;     // soft glow class
  emoji: string;    // 3D glyph
};

// Tier thresholds (successful OTPs)
const TIERS: PerfTier[] = [
  { key: "none",      label: "Rookie",    min: 0,    next: 500,
    className: "bg-muted text-muted-foreground border-border",
    glow: "",
    emoji: "🌱" },
  { key: "silver",    label: "Silver",    min: 500,  next: 2000,
    className: "bg-gradient-to-r from-slate-200 to-slate-100 text-slate-800 border-slate-300",
    glow: "shadow-[0_0_0_2px_rgba(148,163,184,.15)]",
    emoji: "🥈" },
  { key: "gold",      label: "Gold",      min: 2000, next: 5000,
    className: "bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-900 border-amber-400/70",
    glow: "shadow-[0_4px_18px_-6px_rgba(245,158,11,.55)]",
    emoji: "🏅" },
  { key: "diamond",   label: "Diamond",   min: 5000, next: 10000,
    className: "bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-300 text-indigo-900 border-sky-300",
    glow: "shadow-[0_4px_22px_-6px_rgba(56,189,248,.65)]",
    emoji: "💎" },
  { key: "superstar", label: "Superstar", min: 10000,
    className: "bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-400 text-white border-transparent",
    glow: "shadow-[0_6px_28px_-6px_rgba(244,63,94,.65)]",
    emoji: "🌟" },
];

export function getTier(count: number): PerfTier {
  let chosen = TIERS[0];
  for (const t of TIERS) if (count >= t.min) chosen = t;
  return chosen;
}

/** Inline 3D-style emoji glyph (colored, with subtle drop shadow for depth). */
export function TierGlyph({ tier, size = 14 }: { tier: PerfTier; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        fontSize: size,
        lineHeight: 1,
        filter: "drop-shadow(0 1px 1px rgba(0,0,0,.35)) drop-shadow(0 0 2px rgba(255,255,255,.25))",
      }}
      className="inline-block translate-y-[-0.5px]"
    >
      {tier.emoji}
    </span>
  );
}

export function PerfBadge({
  count,
  size = "sm",
  showCount = false,
}: { count: number; size?: "xs" | "sm" | "md"; showCount?: boolean }) {
  const tier = getTier(count);
  if (tier.key === "none" && !showCount) return null;
  const sizing =
    size === "md" ? "text-xs px-2.5 py-1 gap-1.5"
    : size === "xs" ? "text-[10px] px-1.5 py-0.5 gap-1"
    : "text-[11px] px-2 py-0.5 gap-1";
  const glyphPx = size === "md" ? 16 : size === "xs" ? 11 : 13;
  return (
    <span
      title={`${tier.label} • ${count.toLocaleString()} successful OTPs`}
      className={`inline-flex items-center font-bold rounded-full border ${tier.className} ${tier.glow} ${sizing}`}
    >
      <TierGlyph tier={tier} size={glyphPx} />
      <span>{tier.label}</span>
      {showCount && <span className="opacity-80 font-mono">· {count.toLocaleString()}</span>}
    </span>
  );
}
