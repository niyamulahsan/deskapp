import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appConfig } from "@config/app";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "..");

function readJson<T = any>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

function writeIfChanged(file: string, content: string): boolean {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  if (prev === content) {
    console.log(`[config:sync] unchanged ${path.relative(root, file)}`);
    return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf-8");
  console.log(`[config:sync] updated ${path.relative(root, file)}`);
  return true;
}

function syncPackageJson(): boolean {
  const pkgPath = path.join(root, "package.json");
  const pkg = readJson<any>(pkgPath);

  pkg.name = appConfig.name;
  pkg.description = appConfig.description;

  pkg.build = pkg.build ?? {};
  pkg.build.appId = appConfig.appId;
  pkg.build.productName = appConfig.productName;

  pkg.build.nsis = pkg.build.nsis ?? {};
  pkg.build.nsis.shortcutName = appConfig.productName;
  pkg.build.nsis.uninstallDisplayName = appConfig.productName;
  pkg.build.nsis.include = "scripts/installer.nsh";

  // Keep protocols in sync if present; create a minimal one if missing.
  const scheme = appConfig.protocol;
  if (Array.isArray(pkg.build.protocols) && pkg.build.protocols.length > 0) {
    pkg.build.protocols[0].name = appConfig.productName;
    pkg.build.protocols[0].schemes = [scheme];
  } else {
    pkg.build.protocols = [{ name: appConfig.productName, schemes: [scheme] }];
  }

  return writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

function renderInstallerNsh(): string {
  const product = appConfig.productName;
  const folders = Array.from(new Set(appConfig.uninstallDataFolders.filter(Boolean)));
  const rmLines = folders.flatMap((f) => [
    `    RMDir /r "$APPDATA\\${f}"`,
    `    RMDir /r "$LOCALAPPDATA\\${f}"`,
  ]);
  return [
    "; Custom NSIS include for electron-builder (generated from src/config/app.ts via config:sync)",
    "; Adds an uninstall choice: full uninstall (remove user data) or just uninstall (keep user data).",
    "",
    "!macro customUnInstall",
    `  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to completely remove all ${product} data and settings as well?$\\r$\\n$\\r$\\nYes = Full uninstall (remove app data)$\\r$\\nNo = Just uninstall (keep your data/settings)" /SD IDNO IDNO keepData`,
    "    ; Full uninstall: remove Electron user data and common app data locations",
    ...rmLines,
    "  keepData:",
    "!macroend",
    "",
  ].join("\n");
}

function syncInstaller(): boolean {
  const out = path.join(root, "scripts", "installer.nsh");
  return writeIfChanged(out, renderInstallerNsh());
}

function syncUiTitle(): boolean {
  const file = path.join(root, "src", "ui", "index.html");
  if (!fs.existsSync(file)) return false;
  const prev = fs.readFileSync(file, "utf-8");
  const next = prev.replace(/<title>[^<]*<\/title>/i, `<title>${appConfig.productName}</title>`);
  return writeIfChanged(file, next);
}

function main() {
  const a = syncPackageJson();
  const b = syncInstaller();
  const c = syncUiTitle();
  if (!a && !b && !c) console.log("[config:sync] everything up to date");
}

main();
