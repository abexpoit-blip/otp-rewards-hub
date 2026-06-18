import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { NoticeBanner } from "./NoticeBanner";
import { AppFooter } from "./AppFooter";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full mesh-canvas text-foreground">
      {/* Floating ambient blobs for extra depth */}
      <div className="pointer-events-none fixed -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-[520px] w-[520px] rounded-full bg-chart-2/15 blur-[120px]" />
      <div className="pointer-events-none fixed top-1/3 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-chart-3/10 blur-[100px]" />

      <div className="relative z-10 flex min-h-screen w-full p-3 gap-3 sm:p-4 sm:gap-4 lg:p-6 lg:gap-6">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4 lg:gap-6">
          <TopBar />
          <main className="flex-1">
            <NoticeBanner />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      {icon && <div className="mb-1 accent-text">{icon}</div>}
      <h1 className="section-title">{title}</h1>
      {subtitle && <p className="section-sub mt-1">{subtitle}</p>}
    </div>
  );
}
