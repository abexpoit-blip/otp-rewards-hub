import { type ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { AlertTriangle } from "lucide-react";

/**
 * Agent-only client guard. Admin also passes (admin has 'agent' role).
 */
export function AgentProtected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  const isAgent = user.roles?.includes("agent") || user.roles?.includes("admin");
  if (!isAgent) {
    return (
      <AppShell>
        <div className="glass-panel-strong p-12 text-center">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h2 className="mt-3 text-xl font-bold">Agent area</h2>
          <p className="mt-1 text-sm text-muted-foreground">You don't have agent access.</p>
        </div>
      </AppShell>
    );
  }
  return <>{children}</>;
}
