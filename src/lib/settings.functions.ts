import { createServerFn } from "@tanstack/react-start";

/**
 * Public app settings exposed to the UI (rates, limits).
 * No auth — these are not secrets.
 */
export const getPublicSettingsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ otp_rate: number; min_withdraw: number; currency: string }> => {
    const { getSetting } = await import("./settings.server");
    const otp_rate = Number(await getSetting("default_payout", 0.40));
    const min_withdraw = Number(await getSetting("min_withdraw", 500));
    return { otp_rate, min_withdraw, currency: "BDT" };
  });
