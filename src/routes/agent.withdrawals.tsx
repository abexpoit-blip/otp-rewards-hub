import { createFileRoute } from "@tanstack/react-router";
import { AgentProtected } from "@/components/AgentProtected";
import { WithdrawalsPage } from "./withdrawals";

export const Route = createFileRoute("/agent/withdrawals")({
  head: () => ({ meta: [{ title: "Agent · Commission Withdrawals — Nexus X" }] }),
  component: () => (
    <AgentProtected>
      <WithdrawalsPage />
    </AgentProtected>
  ),
});
