/**
 * Dev-only WCAG contrast auditor.
 *
 * Walks the DOM after paint, computes contrast ratio for every visible text
 * element against its effective (first opaque ancestor) background, and logs
 * grouped warnings in the browser console. Helps catch washed-out text early
 * — especially after theme/token changes.
 *
 * Disabled entirely in production builds. Zero runtime cost in prod.
 */
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

// --- WCAG helpers -----------------------------------------------------------

function parseColor(input: string): [number, number, number, number] | null {
  // matches rgb(a) only — getComputedStyle normalizes all colors to rgb/rgba
  const m = input.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/,
  );
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  return [r, g, b, a];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const conv = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * conv(r) + 0.7152 * conv(g) + 0.0722 * conv(b);
}

function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (a + 0.05) / (b + 0.05);
}

function effectiveBackground(el: Element): [number, number, number] {
  let node: Element | null = el;
  while (node) {
    const cs = getComputedStyle(node);
    const parsed = parseColor(cs.backgroundColor);
    if (parsed && parsed[3] >= 0.85) return [parsed[0], parsed[1], parsed[2]];
    node = node.parentElement;
  }
  // fallback: white
  return [255, 255, 255];
}

function isLargeText(cs: CSSStyleDeclaration): boolean {
  const px = parseFloat(cs.fontSize);
  const weight = parseInt(cs.fontWeight, 10) || 400;
  // WCAG: 18pt (~24px) normal, or 14pt (~18.66px) bold
  if (px >= 24) return true;
  if (px >= 18.66 && weight >= 700) return true;
  return false;
}

function hasOwnVisibleText(el: Element): string | null {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = (child.textContent ?? "").trim();
      if (t.length > 0) return t.slice(0, 60);
    }
  }
  return null;
}

// --- Audit pass -------------------------------------------------------------

type Failure = {
  el: Element;
  text: string;
  ratio: number;
  threshold: number;
  fg: string;
  bg: [number, number, number];
};

function audit(): Failure[] {
  const failures: Failure[] = [];
  const elements = document.body.querySelectorAll<HTMLElement>("*");

  for (const el of Array.from(elements)) {
    const text = hasOwnVisibleText(el);
    if (!text) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (parseFloat(cs.opacity) < 0.3) continue;

    const fg = parseColor(cs.color);
    if (!fg || fg[3] < 0.5) continue;
    const fgRgb: [number, number, number] = [fg[0], fg[1], fg[2]];

    const bg = effectiveBackground(el);
    const ratio = contrastRatio(fgRgb, bg);
    const threshold = isLargeText(cs) ? 3 : 4.5;

    if (ratio < threshold) {
      failures.push({ el, text, ratio, threshold, fg: cs.color, bg });
    }
  }
  return failures;
}

// --- React hook -------------------------------------------------------------

export function ContrastAuditor() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const failures = audit();
      if (failures.length === 0) {
        console.info(
          `%c✓ Contrast OK %c${pathname} — no WCAG AA failures detected`,
          "color:#10b981;font-weight:bold",
          "color:#64748b",
        );
        return;
      }
      console.group(
        `%c⚠ Contrast: ${failures.length} failing element${failures.length === 1 ? "" : "s"} on ${pathname}`,
        "color:#ef4444;font-weight:bold",
      );
      for (const f of failures) {
        console.warn(
          `${f.ratio.toFixed(2)}:1 (needs ${f.threshold}:1) — "${f.text}"`,
          { element: f.el, fg: f.fg, bgRgb: f.bg },
        );
      }
      console.groupEnd();
    };

    // wait two frames for fonts/layout to settle, then audit
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setTimeout(run, 250);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
    };
  }, [pathname]);

  return null;
}
