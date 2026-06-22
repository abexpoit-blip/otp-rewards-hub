import { type ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { agentGetProfileFn } from "@/lib/agent.functions";
import { AlertTriangle } from "lucide-react";

/**
 * Agent-only client guard. Admin also passes (admin has 'agent' role).
 * Also forces profile completion before letting agents into other pages.
 * Pass `allowIncompleteProfile` for the settings page itself.
 */
export function AgentProtected({
  children,
  allowIncompleteProfile = false,
}: { children: ReactNode; allowIncompleteProfile?: boolean }) {
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const callProfile = useServerFn(agentGetProfileFn);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const isAgent = !!(user?.roles?.includes("agent") || user?.roles?.includes("admin"));
  const isAdmin = !!user?.roles?.includes("admin");

  const profile = useQuery({
    queryKey: ["agent-profile"],
    queryFn: () => callProfile({ data: { token: token! } }),
    enabled: !!token && isAgent && !isAdmin && !allowIncompleteProfile,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (allowIncompleteProfile || isAdmin) return;
    if (profile.data && !profile.data.profile_complete) {
      navigate({ to: "/agent/settings" });
    }
  }, [profile.data, allowIncompleteProfile, isAdmin, navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
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
