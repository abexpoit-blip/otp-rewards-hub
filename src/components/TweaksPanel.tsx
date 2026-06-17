import { Settings2, X } from "lucide-react";
import { useState } from "react";
import { ACCENTS, useTweaks, type AccentKey } from "@/lib/tweaks";
import { cn } from "@/lib/utils";

export function TweaksPanel() {
  const t = useTweaks();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition hover:bg-sidebar-accent"
      >
        <Settings2 className="size-4" />
        <span>Tweaks</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="m-4 w-[320px] glass-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Tweaks</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Theme is locked to light — this design (Geist Glass Bento) is
                light-first. A dark variant would require reworking every
                white-fixed glass surface. Keeping it out prevents washed-out
                contrast regressions. */}

            {/* Accent */}
            <Group label="Accent color">
              <div className="grid grid-cols-7 gap-2">
                {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => t.setAccent(k)}
                    title={ACCENTS[k].label}
                    className={cn(
                      "h-7 w-7 rounded-md ring-offset-2 ring-offset-card transition",
                      t.accent === k && "ring-2 ring-primary",
                    )}
                    style={{ background: ACCENTS[k].swatch }}
                  />
                ))}
              </div>
            </Group>

            {/* Density */}
            <Group label="Density">
              <Segmented
                value={t.density}
                onChange={(v) => t.setDensity(v as "comfortable" | "compact")}
                options={[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" },
                ]}
              />
            </Group>

            {/* Sidebar */}
            <Group label="Sidebar">
              <Segmented
                value={t.sidebar}
                onChange={(v) => t.setSidebar(v as "expanded" | "collapsed")}
                options={[
                  { value: "expanded", label: "Expanded" },
                  { value: "collapsed", label: "Collapsed" },
                ]}
              />
            </Group>

            {/* Privacy */}
            <Group label="Privacy">
              <Segmented
                value={t.privacy}
                onChange={(v) => t.setPrivacy(v as "show" | "hide")}
                options={[
                  { value: "show", label: "Show numbers" },
                  { value: "hide", label: "Hide numbers" },
                ]}
              />
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Blurs every digit on the page automatically.
              </p>
            </Group>
          </div>
        </div>
      )}
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
            value === o.value
              ? "accent-bg shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
