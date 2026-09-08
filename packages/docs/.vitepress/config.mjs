import { defineConfig } from "vitepress";
import tablerIcons from "@iconify-json/tabler/icons.json" with { type: "json" };

const tabler = tablerIcons.icons;

function icon(name) {
  const data = tabler[name];
  if (!data) throw new Error(`Tabler icon not found: ${name}`);
  return `<span class="vp-nav-icon"><svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">${data.body}</svg></span>`;
}

function label(name, text) {
  return `<span class="vp-nav-icon-wrap">${icon(name)}<span>${text}</span></span>`;
}

export default defineConfig({
  title: "Deskapp",
  description: "Desktop application framework on Deno: windows, native APIs, SQLite, Queue, Cron",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    ["link", { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon-96x96.png" }],
    ["link", { rel: "icon", href: "/favicon.ico", sizes: "any" }],
    ["link", { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" }],
    ["link", { rel: "manifest", href: "/site.webmanifest" }],
    [
      "style",
      {},
      `.vp-nav-icon-wrap{display:inline-flex;align-items:center;line-height:1}.vp-nav-icon{margin-right:7px;display:inline-flex;align-items:center}.vp-nav-icon svg{width:1.35em;height:1.35em;display:block}.VPNavBarMenuLink{line-height:normal !important}.VPNavBarMenuLink .vp-nav-icon-wrap{height:100%}:root{--vp-c-indigo-1:#0077b6;--vp-c-indigo-2:#0096c7;--vp-c-indigo-3:#00b4d8;--vp-c-indigo-soft:rgba(0,119,182,.14)}.dark{--vp-c-indigo-1:#48cae4;--vp-c-indigo-2:#00b4d8;--vp-c-indigo-3:#0096c7;--vp-c-indigo-soft:rgba(72,202,228,.16)}`,
    ],
  ],
  themeConfig: {
    logo: "/deskapp.png",
    nav: [
      { text: label("home", "Home"), link: "/" },
      { text: label("bolt", "Quick Start"), link: "/guide/quick-start" },
      { text: label("book", "Guide"), link: "/guide/introduction" },
      { text: label("puzzle", "API"), link: "/api/" },
      { text: label("tool", "CLI"), link: "/cli/maker" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: label("sparkles", "Getting Started"),
          items: [
            { text: label("info-circle", "Introduction"), link: "/guide/introduction" },
            { text: label("bolt", "Quick Start"), link: "/guide/quick-start" },
          ],
        },
        {
          text: label("tools", "Essentials"),
          items: [
            { text: label("box", "Architecture"), link: "/guide/architecture" },
            { text: label("world", "Environment"), link: "/guide/environment" },
            { text: label("settings", "Configuration"), link: "/guide/configuration" },
            { text: label("components", "Modules"), link: "/guide/modules" },
            { text: label("plug", "Controllers & Bindings"), link: "/guide/controllers" },
            { text: label("device-desktop", "Windows & Native APIs"), link: "/guide/windows" },
            { text: label("database", "Database"), link: "/guide/database" },
            { text: label("device-floppy", "Storage"), link: "/guide/storage" },
            { text: label("photo", "UI (Vue 3)"), link: "/guide/ui" },
          ],
        },
        {
          text: label("server", "Services"),
          items: [
            { text: label("inbox", "Queue"), link: "/guide/queue" },
            { text: label("calendar-clock", "Scheduler"), link: "/guide/scheduler" },
            { text: label("circle-check", "Validation"), link: "/guide/validation" },
            { text: label("lock", "Password & Hashing"), link: "/guide/password" },
            { text: label("browser", "Playwright / Chromium"), link: "/guide/playwright" },
            { text: label("broadcast", "Realtime (Pulse)"), link: "/guide/realtime" },
          ],
        },
      ],
      "/api/": [
        {
          text: label("stack", "Namespaces"),
          items: [
            { text: label("list", "Overview"), link: "/api/" },
            { text: label("device-desktop", "Win"), link: "/api/win" },
            { text: label("apps", "Chrome"), link: "/api/chrome" },
            { text: label("folder-open", "Pickers"), link: "/api/pickers" },
            { text: label("database", "Db"), link: "/api/db" },
            { text: label("list-check", "Paginate"), link: "/api/paginate" },
            { text: label("inbox", "Queue"), link: "/api/queue" },
            { text: label("calendar-clock", "Cron"), link: "/api/cron" },
            { text: label("browser", "Chromium"), link: "/api/chromium" },
            { text: label("lock", "Pass"), link: "/api/pass" },
            { text: label("circle-check", "Validate"), link: "/api/validate" },
            { text: label("folder", "Files"), link: "/api/files" },
            { text: label("device-floppy", "Storage"), link: "/api/storage" },
          ],
        },
      ],
      "/cli/": [
        { text: label("hammer", "Maker Commands"), link: "/cli/maker" },
        { text: label("database", "Database Commands"), link: "/cli/database" },
        { text: label("package", "Bundle & Build"), link: "/cli/bundle" },
      ],
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026-present deskapp",
    },
    search: {
      provider: "local",
    },
    outline: {
      label: "On this page",
    },
    docFooter: {
      prev: "Previous",
      next: "Next",
    },
    lastUpdated: {
      text: "Last updated",
    },
    returnToTopLabel: "Return to top",
    sidebarMenuLabel: "Menu",
    darkModeSwitchLabel: "Appearance",
    lightModeSwitchTitle: "Switch to light mode",
    darkModeSwitchTitle: "Switch to dark mode",
  },
});