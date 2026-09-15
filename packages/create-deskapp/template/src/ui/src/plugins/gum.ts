import axios from "axios";
import type { App, Ref } from "vue";
import { computed, nextTick, reactive, ref, toRaw, watch } from "vue";
import { type LocationQueryRaw, useRoute, useRouter } from "vue-router";

/**
 * gum.ts - Inertia-style request/form helpers for this app.
 *
 * Two interchangeable transports, selected via `GumPlugin` options:
 *
 * - `"bindings"` (default, desktop): the frontend runs inside a Deno Desktop
 *   webview and talks to the backend IN-PROCESS via the `bindings` global
 *   (no HTTP). The "url" is a binding name (`<module>.<controller>.<handler>`,
 *   e.g. `collection.collection.show`) invoked as `bindings[name](...)`.
 * - `"http"` (web/app using a remote API): the "url" is an API endpoint and
 *   gum issues axios requests, so data can come from any HTTP backend.
 *
 * Payload conventions match the generated controllers / REST routes:
 *   index()               -> get    with no data
 *   show(params)          -> get    with `query` (or `data`)
 *   store(body)           -> post   with `data`
 *   update({params,body}) -> put/patch with `query` + `data`
 *   destroy(params)       -> delete with `query` (or `data`)
 */

export type GumTransport = "bindings" | "http";

export type GumPluginOptions = {
  rememberPrefix?: string;
  recentlySuccessfulDuration?: number;
  transport?: GumTransport;
  baseURL?: string;
};

type GumMethod = "get" | "post" | "put" | "patch" | "delete";
type GumVisitOptions = {
  method?: GumMethod;
  data?: Record<string, unknown>;
  query?: Record<string, unknown>;
  routePath?: string;
  replace?: boolean;
  preserveState?: boolean;
  preserveScroll?: boolean;
  skipFetch?: boolean;
  /** GET visits push the query into the route by default; set false to just fetch in-process (no router/scroll work). */
  navigate?: boolean;
  /** Per-call transport override (defaults to the GumPlugin config). */
  transport?: GumTransport;
  /** Per-call HTTP baseURL override (defaults to the GumPlugin config). */
  baseURL?: string;
  onBefore?: () => boolean | undefined | Promise<boolean | undefined>;
  onStart?: () => void | Promise<void>;
  onSuccess?: (response: { data: unknown; }) => void | Promise<void>;
  onError?: (errors: NormalizedErrors, error: GumRequestError) => void | Promise<void>;
  onFinish?: () => void | Promise<void>;
};

type FormMethod = "post" | "put" | "patch" | "delete";
type FormErrors<T> = Partial<Record<keyof T | string, string>>;
export type NormalizedErrors = Record<string, string[] | string>;
type FormSubmitOptions = {
  onStart?: () => void | Promise<void>;
  onSuccess?: () => void | Promise<void>;
  onError?: (errors: NormalizedErrors, error: GumRequestError) => void | Promise<void>;
  onFinish?: () => void | Promise<void>;
};

/**
 * The error shape thrown by the backend registry and by `validate.run` in
 * src/core/utils/validation.ts (zod flatten: `{ fieldErrors, formErrors }`).
 * Kept as `unknown` since it crosses the in-process boundary.
 */
export type GumRequestError = Record<string, unknown> & {
  status?: number;
  message?: string;
  errors?: unknown;
};

const config: Required<GumPluginOptions> = {
  rememberPrefix: "gum",
  recentlySuccessfulDuration: 2000,
  transport: "bindings",
  baseURL: "",
};

/**
 * Why: preserveState=false should clear only state for one page.
 * When: called by remember registration and GET visits.
 * Where: used in this Gum plugin storage registry.
 */
const routeRememberKeys = new Map<string, Set<string>>();

/**
 * Why: route keys must be consistent across query changes.
 * When: before read/write in remember key registry.
 * Where: internal helper for Gum path-based state tracking.
 */
function normalizePath(path: string) {
  const clean = (path || "/").split("?")[0];
  return clean || "/";
}

function registerRememberKey(path: string, key: string) {
  const routePath = normalizePath(path);
  if (!routeRememberKeys.has(routePath)) routeRememberKeys.set(routePath, new Set<string>());
  routeRememberKeys.get(routePath)?.add(key);
}

/**
 * Why: emulate Inertia preserveState=false behavior.
 * When: a GET visit requests state reset.
 * Where: removes entries from localStorage using Gum prefix.
 */
export function clearRememberForPath(path: string) {
  const routePath = normalizePath(path);
  const keys = routeRememberKeys.get(routePath);
  if (!keys) return;
  keys.forEach((key) => localStorage.removeItem(`${config.rememberPrefix}:${key}`));
}

/**
 * A tiny localStorage-backed ref (replaces @vueuse/core's useStorage so gum has
 * no extra dependency). Reads the persisted value on init, merges new defaults
 * over it, and persists on every mutation via Vue's watch.
 */
function useLocalStorage<T extends object>(key: string, initial: T): Ref<T> {
  const raw = localStorage.getItem(key);
  let parsed: Partial<T> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Partial<T>;
    } catch {
      // corrupted value - fall through to defaults
    }
  }

  const state = ref<T>({ ...structuredClone(initial), ...parsed }) as Ref<T>;

  watch(state, (value) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { deep: true });

  return state;
}

/**
 * Why: persist page-local UI state across navigations/reloads.
 * When: page needs remembered filters/forms.
 * Where: composables/pages calling useGumRemember.
 */
export function useGumRemember<T extends object>(key: string, initial: T) {
  const route = useRoute();
  registerRememberKey(route.path, key);

  return useLocalStorage<T>(`${config.rememberPrefix}:${key}`, initial);
}

/**
 * Resolve the global `bindings` object. Under `deno task dev` (or any desktop
 * run) the backend injects it into the webview; outside the desktop shell it
 * is undefined and gum calls fail with a helpful message.
 */
function resolveBindings(): Record<string, (...args: unknown[]) => Promise<unknown>> | undefined {
  const g = globalThis as { bindings?: Record<string, (...args: unknown[]) => Promise<unknown>>; };
  return g.bindings;
}

/**
 * Build the single payload a controller handler expects, matching the
 * framework's handler signatures (show(params) / store(body) /
 * update({ params, body }) / destroy(params)).
 */
function buildPayload(method: GumMethod, data?: Record<string, unknown>, query?: Record<string, unknown>): unknown {
  if (method === "get" || method === "delete") {
    return query ?? data ?? undefined;
  }
  if (method === "put" || method === "patch") {
    return { params: query ?? {}, body: data ?? {} };
  }
  return data ?? undefined;
}

/**
 * Invoke a handler in-process. `url` is the binding name. Returns the response
 * envelope `{ data }` so callers keep reading `response.data`.
 */
async function invokeBinding(
  url: string,
  method: GumMethod,
  data?: Record<string, unknown>,
  query?: Record<string, unknown>,
): Promise<{ data: unknown; }> {
  const bindings = resolveBindings();
  if (!bindings) {
    throw {
      status: 500,
      message: "Bindings unavailable. Run the app via `deno task dev`.",
    };
  }

  const handler = bindings[url];
  if (typeof handler !== "function") {
    throw { status: 404, message: `Binding "${url}" not found. Regenerate with \`deno task maker bindings:gen\`.` };
  }

  const payload = buildPayload(method, data, query);
  const result = await handler(payload);
  return { data: result };
}

/** Resolve `query` and `data` into axios request options per HTTP convention. */
function httpConfig(method: GumMethod, data?: Record<string, unknown>, query?: Record<string, unknown>) {
  if (method === "get" || method === "delete") return { params: query ?? data };
  if (method === "put" || method === "patch") return { params: query, data };
  return { data };
}

/**
 * Invoke a REST endpoint over HTTP. `url` is the API path; `baseURL` (from
 * plugin options) is prepended. The backend should respond with the same
 * envelopes gum expects: success `{ data }`, and validation failures as
 * `{ status: 422, errors: {...} }` thrown through the axios error path.
 */
async function invokeHttp(
  url: string,
  method: GumMethod,
  data?: Record<string, unknown>,
  query?: Record<string, unknown>,
  baseURL: string = config.baseURL,
): Promise<{ data: unknown; }> {
  const cfg = httpConfig(method, data, query);
  try {
    const res = method === "get"
      ? await axios.get(url, { ...cfg, baseURL })
      : method === "delete"
        ? await axios.delete(url, { ...cfg, baseURL })
        : method === "post"
          ? await axios.post(url, cfg.data, { params: cfg.params, baseURL })
          : method === "put"
            ? await axios.put(url, cfg.data, { params: cfg.params, baseURL })
            : await axios.patch(url, cfg.data, { params: cfg.params, baseURL });

    return { data: res.data };
  } catch (error) {
    // Normalize axios failure into the same GumRequestError shape.
    if (axios.isAxiosError(error)) {
      const body = error.response?.data as GumRequestError | undefined;
      throw body ?? {
        status: error.response?.status,
        message: error.message,
      };
    }
    throw error;
  }
}

/**
 * Transport-agnostic entry point. Routes to the configured transport
 * (bindings in-process, or HTTP via axios) and always returns the
 * `{ data }` envelope. A call-level `transport`/`baseURL` overrides the
 * plugin-wide config so a single app can mix SQLite bindings and remote APIs.
 */
async function invoke(
  url: string,
  method: GumMethod,
  data?: Record<string, unknown>,
  query?: Record<string, unknown>,
  transport: GumTransport = config.transport,
  baseURL?: string,
): Promise<{ data: unknown; }> {
  return transport === "http"
    ? invokeHttp(url, method, data, query, baseURL)
    : invokeBinding(url, method, data, query);
}

/**
 * Normalize backend validation failures into gum's per-field error map.
 * Handles triggers thrown by `validate.run` (zod flatten `{ fieldErrors,
 * formErrors }`) plus a flat `errors` map for custom handler returns.
 */
function normalizeValidationErrors(error: GumRequestError): NormalizedErrors {
  const normalized: NormalizedErrors = {};

  const raw = error?.errors as Record<string, unknown> | undefined;
  if (raw) {
    if (typeof raw === "object") {
      const fieldErrors = raw.fieldErrors as Record<string, string[] | string> | undefined;
      if (fieldErrors) {
        for (const [key, value] of Object.entries(fieldErrors)) {
          if (key === "_errors") continue;
          normalized[key] = value;
        }
      }
      const formErrors = raw.formErrors as string[] | string | undefined;
      if (formErrors) {
        normalized.$root ??= Array.isArray(formErrors) ? formErrors : [formErrors];
      }
      if (Object.keys(normalized).length === 0) {
        for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
          if (key === "fieldErrors" || key === "formErrors") continue;
          normalized[key] = Array.isArray(value) ? value.map(String) : String(value);
        }
      }
    }
  }

  const message = error?.message;
  if (message && Object.keys(normalized).length === 0) {
    normalized.$root = message;
  }

  return normalized;
}

/**
 * Why: provide Inertia-style visit API for requests + navigation.
 * When: pages trigger get/post/put/patch/delete/reload flows.
 * Where: frontend pages/composables that import useGum.
 */
export function useGum() {
  const router = useRouter();
  const route = useRoute();
  const processing = ref(false);

  /**
   * Why: unify request lifecycle hooks with router sync.
   * When: any Gum visit method is executed.
   * Where: internal core of useGum().
   */
  async function visit(url: string, options: GumVisitOptions = {}) {
    const {
      method = "get",
      data,
      query,
      routePath,
      replace = false,
      preserveState = method !== "get",
      preserveScroll = false,
      skipFetch = false,
      navigate = method === "get",
      transport,
      baseURL,
      onBefore,
      onStart,
      onSuccess,
      onError,
      onFinish
    } = options;

    const allow = await onBefore?.();
    if (allow === false) return;

    const scrollY = window.scrollY;
    processing.value = true;
    await onStart?.();

    let response: { data: unknown; } | undefined;

    try {
      if (!skipFetch) {
        response = await invoke(url, method, data, query, transport, baseURL);
      }

      if (method === "get" && navigate) {
        const targetRoutePath = routePath ?? route.path;
        if (!preserveState) clearRememberForPath(targetRoutePath);

        const payload = {
          path: targetRoutePath,
          query: (query ?? route.query) as LocationQueryRaw
        };

        if (replace) await router.replace(payload);
        else await router.push(payload);
      }

      await onSuccess?.(response!);
      return response;
    } catch (error) {
      const err = error as GumRequestError;
      const handled = !!options.onError;
      await onError?.(normalizeValidationErrors(err), err);
      if (!handled) throw error;
    } finally {
      processing.value = false;
      await onFinish?.();
      if (preserveScroll) {
        await nextTick();
        requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
      }
    }
  }

  return {
    processing,
    visit,
    get: (url: string, options: Omit<GumVisitOptions, "method"> = {}) => visit(url, { ...options, method: "get" }),
    post: (url: string, data?: Record<string, unknown>, options: Omit<GumVisitOptions, "method" | "data"> = {}) => {
      return visit(url, { ...options, method: "post", data });
    },
    put: (url: string, data?: Record<string, unknown>, options: Omit<GumVisitOptions, "method" | "data"> = {}) => {
      return visit(url, { ...options, method: "put", data });
    },
    patch: (url: string, data?: Record<string, unknown>, options: Omit<GumVisitOptions, "method" | "data"> = {}) => {
      return visit(url, { ...options, method: "patch", data });
    },
    delete: (url: string, options: Omit<GumVisitOptions, "method"> = {}) => visit(url, { ...options, method: "delete" }),
    reload: (options: Omit<GumVisitOptions, "method"> = {}) => {
      return visit(route.path, {
        ...options,
        method: "get",
        replace: true,
        query: route.query as Record<string, unknown>
      });
    }
  };
}

/**
 * Why: centralize form state/errors/progress like Inertia useForm.
 * When: create/update/delete forms submit to backend.
 * Where: frontend forms using useGumForm.
 */
export function useGumForm<T extends Record<string, unknown>>(defaults: T) {
  const initial = structuredClone(defaults);
  const data = reactive(structuredClone(defaults)) as T;
  const errors = reactive<Record<string, string>>({});
  const progress = ref<number | null>(null);
  const processing = ref(false);
  const wasSuccessful = ref(false);
  const recentlySuccessful = ref(false);
  const isDirty = computed(() => JSON.stringify(toRaw(data)) !== JSON.stringify(initial));

  /**
   * Why: allow manual error assignment for custom validations.
   * When: setting one field error outside server response.
   * Where: useGumForm consumer code.
   */
  function setError(field: keyof T | string, message: string) {
    errors[String(field)] = message;
  }

  /**
   * Why: keep error state in sync with user actions/submits.
   * When: before submit or after field corrections.
   * Where: useGumForm internal + consumer calls.
   */
  function clearErrors(...fields: (keyof T | string)[]) {
    if (!fields.length) {
      Object.keys(errors).forEach((key) => delete errors[key]);
      return;
    }
    fields.forEach((field) => delete errors[String(field)]);
  }

  /**
   * Why: restore form values to initial defaults safely.
   * When: cancel edit or after successful submission.
   * Where: useGumForm consumer actions.
   */
  function reset(...fields: (keyof T)[]) {
    if (!fields.length) {
      Object.assign(data, structuredClone(initial));
      clearErrors();
      return;
    }

    fields.forEach((field) => {
      data[field] = structuredClone(initial[field]);
      delete errors[String(field)];
    });
  }

  /**
   * Why: provide a single submission path with lifecycle hooks.
   * When: post/put/patch/delete helpers are called.
   * Where: useGumForm internal request executor.
   */
  async function submit(method: FormMethod, url: string, payload?: Record<string, unknown>, options: FormSubmitOptions = {}) {
    const { onStart, onSuccess, onError, onFinish } = options;
    wasSuccessful.value = false;
    clearErrors();
    processing.value = true;
    progress.value = null;
    await onStart?.();

    try {
      const response = await invoke(url, method, payload ?? toRaw(data));
      wasSuccessful.value = true;
      recentlySuccessful.value = true;
      setTimeout(() => {
        recentlySuccessful.value = false;
      }, config.recentlySuccessfulDuration);
      await onSuccess?.();
      return response;
    } catch (error) {
      const err = error as GumRequestError;
      const normalizedErrors = normalizeValidationErrors(err);

      Object.entries(normalizedErrors).forEach(([key, value]) => {
        errors[String(key)] = Array.isArray(value) ? value[0] : value;
      });

      const handled = !!options.onError;
      await onError?.(normalizedErrors, err);
      if (!handled) throw error;
    } finally {
      processing.value = false;
      progress.value = null;
      await onFinish?.();
    }
  }

  return {
    data,
    errors: errors as FormErrors<T>,
    progress,
    processing,
    wasSuccessful,
    recentlySuccessful,
    isDirty,
    setError,
    clearErrors,
    reset,
    submit,
    post: (url: string, payload?: Record<string, unknown>, options?: FormSubmitOptions) => submit("post", url, payload, options),
    put: (url: string, payload?: Record<string, unknown>, options?: FormSubmitOptions) => submit("put", url, payload, options),
    patch: (url: string, payload?: Record<string, unknown>, options?: FormSubmitOptions) => submit("patch", url, payload, options),
    delete: (url: string, payload?: Record<string, unknown>, options?: FormSubmitOptions) => submit("delete", url, payload, options)
  };
}

/**
 * Why: configure shared Gum behavior globally.
 * When: app bootstrap calls app.use(GumPlugin, options).
 * Where: src/ui/src/app.ts plugin registration.
 */
export const GumPlugin = {
  install(_app: App, options: GumPluginOptions = {}) {
    if (options.rememberPrefix) config.rememberPrefix = options.rememberPrefix;
    if (typeof options.recentlySuccessfulDuration === "number") {
      config.recentlySuccessfulDuration = options.recentlySuccessfulDuration;
    }
    if (options.transport) config.transport = options.transport;
    if (typeof options.baseURL === "string") config.baseURL = options.baseURL;
    if (config.transport === "http" && !config.baseURL) {
      console.warn("[gum] HTTP transport requires a `baseURL` plugin option e.g. app.use(GumPlugin, { transport: 'http', baseURL: '/api' })");
    }
  }
};