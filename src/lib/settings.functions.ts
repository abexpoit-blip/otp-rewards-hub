import { createServerFn } from "@tanstack/react-start";

/**
 * Public app settings exposed to the UI (rates, limits, gate flags).
 * No auth — these are not secrets. Used by login/signup/maintenance UI.
 */
export type PublicSettingsDTO = {
  otp_rate: number;
  min_withdraw: number;
  currency: string;
  signup_enabled: boolean;
  maintenance_mode: boolean;             // FULL — blocks login
  maintenance_banner_enabled: boolean;   // SOFT — app works, banner shown
  maintenance_message: string;
};

export const getPublicSettingsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<PublicSettingsDTO> => {
    const { getSetting } = await import("./settings.server");
    const otp_rate = Number(await getSetting("default_payout", 0.40));
    const min_withdraw = Number(await getSetting("min_withdraw", 500));
    const signup_enabled = Boolean(await getSetting("signup_enabled", true));
    const maintenance_mode = Boolean(await getSetting("maintenance_mode", false));
    const maintenance_banner_enabled = Boolean(await getSetting("maintenance_banner_enabled", false));
    const maintenance_message = String(
      await getSetting("maintenance_message", "System is under maintenance.")
    );
    return {
      otp_rate,
      min_withdraw,
      currency: "BDT",
      signup_enabled,
      maintenance_mode,
      maintenance_banner_enabled,
      maintenance_message,
    };
  });
