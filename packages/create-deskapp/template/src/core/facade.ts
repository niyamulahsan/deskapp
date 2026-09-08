/**
 * facade.ts - central public API surface for framework consumers.
 *
 * App-layer code (module controllers, jobs, schedules, models) should import
 * its framework utilities from here in one place instead of reaching into core
 * internals. Each service is surfaced as it gets implemented; only what is
 * actually implemented is re-exported so the facade stays truthful.
 */

// Configuration

// Desktop window control
export {
  type BrowserWindowOptions,
  type DesktopWindow,
  win,
} from "@/window/manager.ts";

// Desktop-native APIs: menu item types, tray, dialogs, and chrome setup
export {
  chrome,
  type DesktopTray,
  type MenuActionItem,
  type MenuItem,
  type MenuRole,
  type MenuSubmenu,
} from "@/window/native.ts";

// Native Windows file/folder pickers (Explorer-style Open / Save As / folder)
export {
  pickers,
  type PickFolderOptions,
  type PickOpenOptions,
  type PickSaveOptions,
} from "@/window/dialogs.ts";

// Database (query client + lifecycle: `db.init()` / `db.close()`)
export { db, type DrizzleDatabase } from "@/core/database/connection.ts";

// Pagination (nexgen-style envelope); `sql` for where filters
export {
  paginate,
  type PaginatedResult,
  type PaginateInput,
  type PaginateModelOptions,
  type PaginateQueryOptions,
  type PaginateTableOptions,
  sql,
} from "@/core/database/paginate.ts";

// Concurrency / job queue
export { type Queue, queue, type QueueTask } from "@/core/utils/queue.ts";

// Cron scheduling (backed by croner)
export { cron, type CronHandle } from "@/core/utils/scheduler.ts";

// Browser automation (Playwright): locate the bundled Chromium + extensions
export { chromium } from "@/core/utils/playwright.ts";

// Security / hashing utilities
export { pass } from "@/core/utils/password.ts";

// Validation (zod schemas + runner: `validate.z`, `validate.run`)
export { validate } from "@/core/utils/validation.ts";

// File / storage utilities
// 1) User-file layer: operate on ANY path the user picks
export { files } from "@/core/utils/storage.ts";

// 2) App-managed layer: the app's own internal state (private + tmp)
export { type Disk, type FileData, storage } from "@/core/utils/storage.ts";
