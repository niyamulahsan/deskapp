/**
 * config.ts - runtime framework configuration.
 *
 * Feature flags are read from the environment with sensible defaults, mirroring
 * engine's config-driven approach (e.g. `frontendEnabled`). App code imports
 * this fresh (or through the facade) instead of scattering Deno.env reads.
 *
 * Flags:
 *   DESKAPP_UI=(true|false)  serve/ship the frontend + open windows.
 *                            false = headless: server-only + tray, no window.
 */

/** Parse a boolean env var: "1"/"true"/"yes"/"on" are on, anything else off. */
export function envBool(name: string, fallback: boolean): boolean {
  const value = Deno.env.get(name);
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

const uiEnabled = () => envBool("DESKAPP_UI", true);

export const config = {
  appName: "Deskapp",
  ui: {
    /** True when the frontend should be served and a window opened. */
    enabled: uiEnabled(),
  },
};