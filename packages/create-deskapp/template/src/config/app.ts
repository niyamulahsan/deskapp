/**
 * App identity config — edit this file to name/brand your app (0 hassle).
 * After changing, run: `npm run config:sync` (or `npm run maker -- config:sync`)
 * to update package.json + NSIS installer fields. Runtime config also reads from here.
 *
 * You can add more config files in this folder later (e.g. database.ts, window.ts)
 * and export them from here or import directly.
 */
export const appConfig = {
  /** npm package name (kebab-case) */
  name: "deskapp",
  /** Display / product name (installer name, app title, shortcuts) */
  productName: "Deskapp",
  /** Short description */
  description: "Deskapp - Electron desktop app framework",
  /** Unique app/protocol identifier (reverse-domain style) */
  appId: "com.deskapp.app",
  /** Deep-link/protocol scheme (lowercase, no spaces) */
  protocol: "deskapp",
  /** Folders used by the NSIS "Full uninstall" option (user data). Keep in sync with actual storage/userData names. */
  uninstallDataFolders: ["Deskapp", "deskapp", "com.deskapp.app"],
} as const;

export type AppConfig = typeof appConfig;
