---
layout: home

hero:
  name: "deskapp"
  text: "Desktop Application Framework"
  tagline: Deno Desktop windows + native APIs + Vue 3 UI + SQLite/Drizzle + Queue &amp; Cron
  image:
    src: /deskapp.png
    alt: deskapp
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: Start a Project
      link: /guide/quick-start

features:
  - icon: 🖥️
    title: Native desktop
    details: Windows with presets, system tray, menus, dialogs and native file pickers on Windows, macOS and Linux.
  - icon: 🔌
    title: Bindings
    details: Backend controllers are auto-registered and callable from the UI in-process as <code>bindings['&lt;module&gt;.&lt;controller&gt;.&lt;handler&gt;']()</code>.
  - icon: 🗄️
    title: Drizzle + SQLite
    details: Type-safe database access, auto-generated schema and migrations, [nexgen](https://niyamulahsan.github.io/nexgen/)-style pagination.
  - icon: 💾
    title: Two-layer storage
    details: Unlimited user-file operations plus an app-managed private/tmp area with atomic writes.
  - icon: ⏰
    title: Queue &amp; Scheduler
    details: Bounded in-process queue and croner-backed scheduling built into the facade.
  - icon: 🚀
    title: Scaffold &amp; build
    details: <code>deno create jsr:@niyam/deskapp my-app</code> gets you running, and <code>deno task maker bundle:win</code> ships a package.
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #2c9c8a 30%, #3fb8a8);
}
.VPHero .VPImage {
  max-height: 180px;
  width: auto;
}
</style>