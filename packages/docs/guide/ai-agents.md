# AI Agents

Every project created with `create-deskapp` ships an **`AGENTS.md`** at its root.
It is the contract a coding agent reads before it writes a line of code: the
project layout, the module conventions, the binding contract, and the commands to
scaffold and verify. This page explains what is in that file and how the rest of
the documentation is exposed to an agent.

## What ships in your project

| File        | Purpose                                                        |
| ----------- | -------------------------------------------------------------- |
| `AGENTS.md` | The rules. Deskapp has a single engine (Electron), so there is one file. |

The file is written as a strict contract, not a tutorial: sixteen numbered
sections (`§0 Non-negotiables` through `§15 Before you say "done"`), each a list
of concrete do / never rules so an agent can follow it without interpreting
prose. `§0` overrides everything else, and the closing checklist restates what
must be true before a change is called done.

::: tip Agents read it automatically
Most coding agents (OpenCode, Cursor, Codex, Claude Code, …) look for
`AGENTS.md` in the project root on their own. You do not have to paste it into
the prompt.
:::

## Documentation for agents

The full documentation stays online — nothing is copied into your project.

- **[`llms.txt`](/llms.txt)** — an index of every page with a one-line
  description. Point an agent here first.
- **[`llms-full.txt`](/llms-full.txt)** — every page concatenated into a single
  file, for an agent that would rather read the whole set in one request.

Both are generated from this site at build time (see
`packages/docs/scripts/gen-llms.mjs`), so they never drift from the published
pages. They live at the site root, so the links above resolve to the same file on
the published site and on your local dev server — nothing to configure, no MCP
server.

## The rules the agent follows

These are the conventions described in [Conventions](/guide/conventions) and
[Modules](/guide/modules), restated as the short list an agent needs:

1. **Never edit `src/core/**`.** It is the framework, not your application. Your
   code lives in `src/modules/**`, `src/config/**`, `src/ui/**`, `src/main.ts`
   and `src/preload.ts`. `src/window/**` is app-shipped too, but the menu/tray
   files (`src/window/app-menu.ts`, `context-menu.ts`, `tray.ts`) are the
   intended place to customize desktop chrome.
2. **Never hand-edit generated files** — `bindings.generated.ts`,
   `src/database/schema.ts`, `src/database/migrations/**`. Regenerate them with
   the maker.
3. **Directory = meaning.** A controller only exists as
   `src/modules/<module>/controllers/<controller>.controller.ts`.
4. **Every controller exports a `handlers` map.** A handler not in the map is
   never registered.
5. **Import the framework only from `@/core/facade`** — never a deep
   `@/core/**` path.
6. **The renderer never imports backend code.** The UI reaches the backend only
   through `bindings` / `md`.
7. **Every file opens with its location header.** Line 1 is
   `// ./<path-from-project-root>` (a Vue SFC uses `<!-- ./<path> -->`), then one
   blank line. `maker` writes it; keep it in place.
8. **Schemas are the single source of truth for input and type.** Declare
   `<X>Schema` and derive `<X>Type = z.input<...>` on the next line.
9. **Modules talk through their `facade.ts`** — import from
   `@/modules/<m>/facade`, never another module's `controllers/` or `database/`
   directly.
10. **Regenerate after structural changes:** `bindings:gen` after a controller
    change, `db:generate` after a model change, `config:sync` after an identity
    change.

## Backend rules

- **Every list handler returns the paginator's envelope.** Use
  `paginate.query` / `paginate.table` / `paginate.model` — never a hand-written
  `LIMIT`/`OFFSET`. See [Database](/guide/database#pagination).
- **Validate with `validate.run`, not `schema.parse`.** It throws the normalized
  `{ status: 422, message, errors }` shape that `gum` renders into per-field form
  errors. See [Validation](/guide/validation).
- **A controller handler is a plain async function** that takes and returns
  JSON-serializable values. It receives IPC args — validate and narrow every
  `unknown` first.
- **Background work uses `queue` and `cron` from the facade** — a bounded
  in-process queue and named croner schedules. See [Queue](/guide/queue) and
  [Scheduler](/guide/scheduler).
- **App state uses `storage`; user files use `files` + `pickers`.** Never build
  app-state paths by hand. See [Storage](/guide/storage).

## Frontend rules

The UI (`src/ui/`) has its own conventions, and this is where improvised code
drifts most:

- **`@/ui/*` is `src/ui/src/*`** — a different root from backend code, where
  `@/*` is `src/`. A page imports `@/ui/components/...`; it never imports
  `@/modules/...`.
- **Requests go through `gum`** (`@/ui/plugins/gum.ts`) — `useGum()` for one-off
  calls and `useGum(defaults).form` for forms — not a raw `bindings[...]` call
  sprinkled through a template. See [Gum](/guide/gum).
- **Lists use `DataTable`** (`@/ui/components/datatable/index.vue`) with `#thead` /
  `#tbody` slots. Point it at a binding that returns the paginate envelope
  (`:path`), or pass the page's own envelope with `:data` and wire its controls to
  a store action with `:fetcher`; `:loop` renders a static list. See
  [Gum](/guide/gum#datatable--the-gum-component).
- **Menus & tray are app code.** To change the application menu, right-click menu
  or system tray, edit `src/window/app-menu.ts`, `src/window/context-menu.ts` and
  `src/window/tray.ts` directly. See
  [Windows & Native APIs](/guide/windows#modifying-menus--tray).
- **Register the route.** A page lives at `pages/<name>/index.vue` and is added
  to `router/index.ts` as a lazy import.
- **Realtime goes through `@/ui/plugins/pulse.ts`**, cleaned up on unmount —
  never a raw `WebSocket`, `EventSource` or polling loop.

## Verifying the agent's work

The `AGENTS.md` asks an agent to finish with the same gates you would run
yourself:

```bash
npm test            # vitest
npm run typecheck   # tsc (backend + UI)
npm run lint        # biome
npm run build       # config:sync + db:schema + bindings:gen + vite + esbuild
```

See [Unit Testing](/guide/testing) for the module test pattern.
