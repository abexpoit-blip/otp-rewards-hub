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
  notices_enabled: boolean;              // Master switch for notice system
};

const DEFAULT_PUBLIC_SETTINGS: PublicSettingsDTO = {
  otp_rate: 0.40,
  min_withdraw: 500,
  currency: "BDT",
  signup_enabled: true,
  maintenance_mode: false,
  maintenance_banner_enabled: false,
  maintenance_message: "System is under maintenance.",
  notices_enabled: true,
};

export const getPublicSettingsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<PublicSettingsDTO> => {
    try {
      const { getSetting } = await import("./settings.server");
      const otp_rate = Number(await getSetting("default_payout", 0.40));
      const min_withdraw = Number(await getSetting("min_withdraw", 500));
      const signup_enabled = Boolean(await getSetting("signup_enabled", true));
      const maintenance_mode = Boolean(await getSetting("maintenance_mode", false));
      const maintenance_banner_enabled = Boolean(await getSetting("maintenance_banner_enabled", false));
      const maintenance_message = String(
        await getSetting("maintenance_message", "System is under maintenance.")
      );
      const notices_enabled = Boolean(await getSetting("notices_enabled", true));
      return {
        otp_rate, min_withdraw, currency: "BDT", signup_enabled,
        maintenance_mode, maintenance_banner_enabled, maintenance_message,
        notices_enabled,
      };
    } catch (e: any) {
      console.warn("[settings] getPublicSettings DB unavailable, using defaults:", e?.message);
      return DEFAULT_PUBLIC_SETTINGS;
    }
  });
