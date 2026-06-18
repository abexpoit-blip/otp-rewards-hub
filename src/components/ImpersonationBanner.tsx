import { useAuth } from "@/lib/auth";
import { UserCog, LogOut } from "lucide-react";

export function ImpersonationBanner() {
  const { impersonating, user, exitImpersonation } = useAuth();
  if (!impersonating || !user) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/15 backdrop-blur p-3 flex items-center gap-3 shadow-lg shadow-amber-500/10">
      <div className="size-9 rounded-md bg-amber-500/20 grid place-items-center">
        <UserCog className="size-5 text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
          Impersonation mode — signed in as <span className="font-mono">{user.email}</span>
        </div>
        <div className="text-[11px] text-amber-800/80 dark:text-amber-200/80 truncate">
          Original admin: <span className="font-mono">{impersonating.adminEmail}</span> · all actions are logged in the audit trail.
        </div>
      </div>
      <button
        onClick={exitImpersonation}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow"
      >
        <LogOut className="size-3.5" /> Exit to admin
      </button>
    </div>
  );
}
