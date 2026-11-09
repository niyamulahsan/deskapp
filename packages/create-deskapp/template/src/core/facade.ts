/**
 * facade - central public API surface for framework consumers.
 *
 * App-layer code (module controllers, jobs, schedules, models) should import
 * its framework utilities from here in one place instead of reaching into core
 * internals. Each service is surfaced as it gets implemented; only what is
 * actually implemented is re-exported so the facade stays truthful.
 */

// Configuration

// Database (query client + lifecycle: `db.init()` / `db.close()`)
export { type DrizzleDatabase, db } from "@/core/database/connection";
// Pagination (nexgen-style envelope); `sql` for where filters
export {
  type PaginatedResult,
  type PaginateInput,
  type PaginateModelOptions,
  type PaginateQueryOptions,
  type PaginateTableOptions,
  paginate,
  sql
} from "@/core/database/paginate";
// Security / hashing utilities
export { pass } from "@/core/utils/password";
// Browser automation (Playwright): locate the bundled Chromium + extensions
export { chromium } from "@/core/utils/playwright";
// Concurrency / job queue
export { type Queue, type QueueTask, queue } from "@/core/utils/queue";
// Cron scheduling (backed by croner)
export { type CronHandle, cron } from "@/core/utils/scheduler";
// File / storage utilities
// 1) User-file layer: operate on ANY path the user picks
// 2) App-managed layer: the app's own internal state (private + tmp)
export { type Disk, type FileData, files, storage } from "@/core/utils/storage";
// Validation (zod schemas + runner: `validate.z`, `validate.run`)
export { validate } from "@/core/utils/validation";
// Native Windows file/folder pickers (Explorer-style Open / Save As / folder)
export {
  type PickFolderOptions,
  type PickOpenOptions,
  type PickSaveOptions,
  pickers
} from "@/window/dialogs";
// Desktop window control
export {
  type BrowserWindowOptions,
  type DesktopWindow,
  win
} from "@/window/manager";
// Desktop-native APIs: menu item types, tray, dialogs, and chrome setup
export {
  chrome,
  type DesktopTray,
  type MenuActionItem,
  type MenuItem,
  type MenuRole,
  type MenuSubmenu
} from "@/window/native";
