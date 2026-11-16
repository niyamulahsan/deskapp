# Unit Testing

deskapp uses [Vitest](https://vitest.dev/) as the built-in test runner. Tests run
on Node with globals enabled — you do not have to import `describe`, `it` or
`expect`.

## Quick start

Create a test under a module's `__tests__/` folder with a `.test.ts` extension:

```ts
// src/modules/blog/__tests__/post.test.ts
describe("blog post", () => {
  it("filters active posts", () => {
    const posts = [
      { id: 1, active: true },
      { id: 2, active: false },
    ];
    expect(posts.filter((p) => p.active)).toHaveLength(1);
  });
});
```

Run it:

```bash
npm test
```

## Where tests live

- Backend tests: `src/modules/<module>/__tests__/<name>.test.ts` — scaffold one
  with the maker:

  ```bash
  npm run maker make:test blog Post      # __tests__/post.test.ts
  npm run maker module:make-test blog    # alias; __tests__/blog.test.ts
  ```

- `src/**/*.test.ts` and `src/**/*.spec.ts` are collected, but **`src/ui/**` is
  excluded** — the renderer is not part of the Vitest project. Test the backend
  handler that a page calls, not the page.
- Coverage excludes `src/ui/**`, `src/storage/**`, `src/core/maker/**`, and any
  `*.test.ts` / `*.d.ts` files.

## Configuration

Vitest is pre-configured in `vitest.config.ts` at the project root:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@config": fileURLToPath(new URL("./src/config", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@/ui": fileURLToPath(new URL("./src/ui/src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["src/ui/**", "src/storage/**", "node_modules/**", "dist/**", "out/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/ui/**", "src/storage/**", "src/core/maker/**", "src/**/*.d.ts", "src/**/*.test.ts", "src/**/*.spec.ts"],
    },
  },
});
```

| Option          | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| **Globals**     | `true` — `describe`, `it`, `expect` available without imports |
| **Include**     | `src/**/*.test.ts`, `src/**/*.spec.ts`                        |
| **Exclude**     | UI, storage, node_modules, dist, out                          |
| **Environment** | `node`                                                        |
| **Aliases**     | `@` → `./src`, `@config` → `./src/config`, `@/ui` → `./src/ui/src` |
| **Coverage**    | V8 provider, text + JSON + HTML reporters, no threshold       |

The `@/`, `@config` and `@/ui` aliases resolve in tests exactly as in app code,
so a test imports the same way a controller does.

## Testing controllers

A controller handler is a plain async function — call it with a plain object and
assert on the returned JSON. The only wrinkle is the facade: when a handler
touches `db`, `queue`, `cron`, `storage` and friends, mock `@/core/facade` so the
test stays in-process and deterministic.

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const stop = vi.fn();
vi.mock("@/core/facade", () => ({
  queue: {
    create: (_opts: { concurrency: number }) => ({ add: (task: () => Promise<unknown>) => task() }),
  },
  cron: {
    schedule: vi.fn((_name: string, _expr: string, task: () => void) => {
      task();
      return { stop };
    }),
    stop: vi.fn(),
  },
}));

import { handlers, queue } from "@/modules/app/controllers/demo.controller";

describe("app demo.controller", () => {
  afterEach(() => vi.useRealTimers());

  it("exposes handlers", () => {
    expect(handlers.queue).toBe(queue);
  });

  it("runs queued items", async () => {
    const res = await queue({ items: ["x", "y"], concurrency: 2, delayMs: 0 });
    expect(res.results).toHaveLength(2);
  });
});
```

Notes:

- `vi.mock("@/core/facade", ...)` is hoisted, so it must be declared before the
  import of the code under test (as above).
- Assert that every new handler is present in `handlers` — that map is what makes
  a handler reachable from the UI.
- Validation failures are thrown objects, not `Error`s:
  `await expect(handler({})).rejects.toMatchObject({ status: 422 })`.

## Running tests

| Script              | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm test`          | Run all tests once (`vitest run`)    |
| `npm run test:watch`| Re-run on change (`vitest`)          |
| `npm run test:coverage` | Run once and print a coverage report |

Filter a file or a test name with the Vitest CLI:

```bash
npx vitest run post
npx vitest run -t "filters active"
```

## Coverage

`npm run test:coverage` writes a terminal summary plus `coverage/coverage-final.json`
and a browsable `coverage/index.html`.

The scaffolded `vitest.config.ts` ships **without** a `thresholds` block on
purpose: a brand-new project has almost no application code, so a floor would
fail on the first run for a number you did not cause. Once you have written tests
for your own code, add one:

```ts
coverage: {
  // ...
  thresholds: { statements: 25, branches: 20, functions: 25, lines: 25 },
},
```

Or for a single run, without editing the file:

```bash
npm run test:coverage -- --coverage.thresholds.statements=25
```

::: warning Do not lower a threshold to make a run pass
A dropped number means a test was deleted or a path stopped running — that is
information, not noise to edit away.
:::

### Coverage will not find your bug

A percentage counts lines that ran. It cannot see the failures that reach
production:

- **A leaked resource.** Every line of a function that opens a connection,
  subscribes a listener, or starts a timer can be covered and still leak.
- **State that survives a call.** A counter that never resets, or data from one
  window appearing in another, is fully covered code with a bug in it.
- **A wrong answer on an unusual input.** That is a missing case, not a missing
  line.

For those, write the test that reproduces the specific failure — and for anything
that holds a resource, assert on the resource (count the listeners, call it a
hundred times and check nothing grew).

## Related

- [Conventions](/guide/conventions) — where tests live in the module tree
- [Controllers & Bindings](/guide/controllers) — the handler contract you test
- [CLI: Maker Commands](/cli/maker) — `make:test`
