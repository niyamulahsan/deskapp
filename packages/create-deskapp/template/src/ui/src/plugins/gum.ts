import axios, { type AxiosError, type AxiosProgressEvent, type AxiosResponse } from "axios";
import type { App } from "vue";
import { computed, nextTick, reactive, ref, toRaw, watch } from "vue";
import { type LocationQueryRaw, useRoute, useRouter } from "vue-router";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type GumTransport = "bindings" | "http";

export type GumPluginOptions = {
  rememberPrefix?: string;
  recentlySuccessfulDuration?: number;
  /** Default transport. Auto-detects: bindings when `globalThis.bindings` exists, else http. */
  transport?: GumTransport;
  /** Base URL for HTTP transport (e.g. "/api" or "https://api.example.com"). */
  baseURL?: string;
};

type GumMethod = "get" | "post" | "put" | "patch" | "delete";
type FormMethod = "post" | "put" | "patch" | "delete";

type LifecycleHooks = {
  onBefore?: () => boolean | undefined | Promise<boolean | undefined>;
  onStart?: () => void | Promise<void>;
  onProgress?: (event: AxiosProgressEvent) => void;
  onSuccess?: (response: AxiosResponse) => void | Promise<void>;
  onError?: (errors: NormalizedErrors, error: unknown) => void | Promise<void>;
  onFinish?: () => void | Promise<void>;
};

/**
 * A fetcher returns either an AxiosResponse-like payload or any plain value.
 * Gum wraps plain values into `{ data, status: 200, ... }`.
 */
type Fetcher = (payload: Record<string, unknown> | FormData) => Promise<unknown>;

type GumVisitOptions = LifecycleHooks & {
  method?: GumMethod;
  data?: Record<string, unknown> | FormData;
  query?: Record<string, unknown>;
  routePath?: string;
  replace?: boolean;
  preserveState?: boolean;
  preserveScroll?: boolean;
  skipFetch?: boolean;
  /** GET visits sync the route by default; set false to fetch without navigation. */
  navigate?: boolean;
  fetcher?: Fetcher;
  /** Per-call transport override. */
  transport?: GumTransport;
  /** Per-call baseURL override (HTTP transport). */
  baseURL?: string;
};

type VisitWithFetcherOptions = Omit<GumVisitOptions, "method" | "fetcher"> & { fetcher: Fetcher };
type VisitWithFetcherDataOptions = VisitWithFetcherOptions & {
  data?: Record<string, unknown> | FormData;
};

type FormSubmitOptions<T> = LifecycleHooks & {
  validate?: (data: T) => Record<string, string> | null | undefined;
  transform?: (data: T) => Record<string, unknown> | FormData;
  fetcher?: Fetcher;
};

type FormWithFetcherOptions<T> = Omit<FormSubmitOptions<T>, "fetcher"> & { fetcher: Fetcher };

type FormErrors<T> = Partial<Record<keyof T | string, string>>;
export type NormalizedErrors = Record<string, string[] | string>;

type ValidationErrorPayload = {
  errors?: Record<string, string[] | string>;
  error?: { issues?: Array<{ path?: Array<string | number>; message?: string }> };
  // bindings/zod-flatten style
  fieldErrors?: Record<string, string[] | string>;
  formErrors?: string[] | string;
  message?: string;
};

/* -------------------------------------------------------------------------- */
/* Config + registry                                                          */
/* -------------------------------------------------------------------------- */

const config = {
  rememberPrefix: "gum",
  recentlySuccessfulDuration: 2000,
  transport: undefined as GumTransport | undefined,
  baseURL: ""
};

function effectiveTransport(override?: GumTransport): GumTransport {
  if (override) return override;
  if (config.transport) return config.transport;
  const g = globalThis as { bindings?: unknown };
  return g.bindings ? "bindings" : "http";
}

const routeRememberKeys = new Map<string, Set<string>>();

function normalizePath(path: string) {
  const clean = (path || "/").split("?")[0];
  return clean || "/";
}

function registerRememberKey(path: string, key: string) {
  const routePath = normalizePath(path);
  if (!routeRememberKeys.has(routePath)) routeRememberKeys.set(routePath, new Set());
  routeRememberKeys.get(routePath)!.add(key);
}

export function clearRememberForPath(path: string) {
  const routePath = normalizePath(path);
  const keys = routeRememberKeys.get(routePath);
  if (!keys) return;
  keys.forEach((key) => localStorage.removeItem(`${config.rememberPrefix}:${key}`));
}

/* -------------------------------------------------------------------------- */
/* Global processing tracker                                                  */
/* -------------------------------------------------------------------------- */

const globalProcessing = ref(false);
let activeRequests = 0;

function trackStart() {
  activeRequests++;
  globalProcessing.value = true;
}

function trackEnd() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) globalProcessing.value = false;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function normalizeValidationErrors(payload?: unknown): NormalizedErrors {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as ValidationErrorPayload;
  const normalized: NormalizedErrors = { ...(p.errors ?? {}) };

  if (p.fieldErrors && typeof p.fieldErrors === "object") {
    for (const [k, v] of Object.entries(p.fieldErrors)) {
      if (k !== "_errors") normalized[k] = v;
    }
  }
  if (p.formErrors) {
    normalized.$root ??= Array.isArray(p.formErrors) ? p.formErrors : [p.formErrors];
  }
  const issues = p.error?.issues;
  if (Array.isArray(issues)) {
    issues.forEach((issue) => {
      const key = issue.path?.map(String).join(".");
      if (key) normalized[key] = String(issue.message || "Invalid value");
    });
  }
  if (p.message && Object.keys(normalized).length === 0) normalized.$root = p.message;
  return normalized;
}

async function runBefore(onBefore?: LifecycleHooks["onBefore"]) {
  const allow = await onBefore?.();
  return allow !== false;
}

async function restoreScroll(enabled: boolean, y: number) {
  if (!enabled) return;
  await nextTick();
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior })));
}

function startRecentTimer(target: { recentlySuccessful: { value: boolean } }) {
  target.recentlySuccessful.value = true;
  setTimeout(() => {
    target.recentlySuccessful.value = false;
  }, config.recentlySuccessfulDuration);
}

function readScrollY(): number {
  return typeof window !== "undefined" ? window.scrollY : 0;
}

function asResponse(data: unknown, status = 200): AxiosResponse {
  return { data, status, statusText: "OK", headers: {}, config: {} as any } as AxiosResponse;
}

function resolveBindings(): Record<string, (...args: unknown[]) => Promise<unknown>> | undefined {
  const g = globalThis as { bindings?: Record<string, (...args: unknown[]) => Promise<unknown>> };
  return g.bindings;
}

function buildBindingPayload(method: GumMethod, data?: unknown, query?: unknown): unknown {
  const q = (query && typeof query === "object" ? query : undefined) as Record<string, unknown> | undefined;
  const d = (data && typeof data === "object" ? data : undefined) as Record<string, unknown> | undefined;
  if (method === "get" || method === "delete") return q ?? d ?? undefined;
  if (method === "put" || method === "patch") return { params: q ?? {}, body: d ?? {} };
  return d ?? data ?? undefined;
}

/* -------------------------------------------------------------------------- */
/* Transport execution                                                        */
/* -------------------------------------------------------------------------- */

type ExecuteOptions = {
  method: GumMethod;
  url?: string;
  payload?: Record<string, unknown> | FormData;
  query?: Record<string, unknown>;
  fetcher?: Fetcher;
  onProgress?: (event: AxiosProgressEvent) => void;
  transport?: GumTransport;
  baseURL?: string;
};

async function execute(options: ExecuteOptions): Promise<AxiosResponse> {
  if (options.fetcher) {
    const result = await options.fetcher(options.payload ?? {});
    const looksLikeResponse =
      result !== null &&
      typeof result === "object" &&
      "data" in (result as Record<string, unknown>) &&
      typeof (result as { status?: unknown }).status === "number";
    return looksLikeResponse ? (result as AxiosResponse) : asResponse(result);
  }

  const transport = effectiveTransport(options.transport);
  if (transport === "bindings") {
    const bindings = resolveBindings();
    if (!bindings) {
      const err: any = new Error(
        'Bindings unavailable. The desktop bridge (`globalThis.bindings`) is not injected. Run inside the desktop app, or use `GumPlugin` with `{ transport: "http", baseURL }` for web/API mode.'
      );
      err.response = { data: { message: err.message } };
      throw err;
    }
    if (!options.url) throw new Error("gum: bindings transport requires a binding name (url).");
    const handler = bindings[options.url];
    if (typeof handler !== "function") {
      const err: any = new Error(`Binding "${options.url}" not found.`);
      err.response = { status: 404, data: { message: err.message } };
      throw err;
    }
    const result = await handler(buildBindingPayload(options.method, options.payload, options.query));
    return asResponse(result);
  }

  // HTTP transport
  if (!options.url) throw new Error("gum: HTTP transport requires a URL.");
  const baseURL = options.baseURL ?? config.baseURL;
  return await axios.request({
    method: options.method,
    url: options.url,
    baseURL: baseURL || undefined,
    params: options.query,
    data: options.method === "get" ? undefined : options.payload,
    onUploadProgress: options.onProgress
  });
}

/* -------------------------------------------------------------------------- */
/* Remember                                                                   */
/* -------------------------------------------------------------------------- */

function useLocalStorage<T extends object>(key: string, initial: T) {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  let parsed: Partial<T> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Partial<T>;
    } catch {}
  }
  const state = ref<T>({ ...structuredClone(initial), ...parsed }) as any;
  watch(
    state,
    (value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
    { deep: true }
  );
  return state as { value: T };
}

export function useGumRemember<T extends object>(key: string, initial: T) {
  const route = useRoute();
  registerRememberKey(route.path, key);
  return useLocalStorage<T>(`${config.rememberPrefix}:${key}`, initial);
}

/* -------------------------------------------------------------------------- */
/* Visit API                                                                  */
/* -------------------------------------------------------------------------- */

function buildVisitApi() {
  const router = useRouter();
  const route = useRoute();

  async function runVisit(params: {
    method: GumMethod;
    url?: string;
    data?: Record<string, unknown> | FormData;
    query?: Record<string, unknown>;
    routePath?: string;
    replace?: boolean;
    preserveState?: boolean;
    preserveScroll?: boolean;
    skipFetch?: boolean;
    navigate?: boolean;
    fetcher?: Fetcher;
    transport?: GumTransport;
    baseURL?: string;
    hooks?: GumVisitOptions;
  }) {
    const {
      method,
      url,
      data,
      query,
      routePath,
      replace = false,
      preserveState = method !== "get",
      preserveScroll = false,
      skipFetch = false,
      navigate = method === "get",
      fetcher,
      transport,
      baseURL,
      hooks = {}
    } = params;

    const { onBefore, onStart, onProgress, onSuccess, onError, onFinish } = hooks;
    if (!(await runBefore(onBefore))) return;

    const savedY = readScrollY();
    trackStart();

    let response: AxiosResponse | undefined;
    try {
      await onStart?.();
      if (!skipFetch) {
        try {
          response = await execute({ method, url, payload: data, query, fetcher, onProgress, transport, baseURL });
        } catch (error) {
          const err = error as AxiosError<ValidationErrorPayload> & { response?: { data?: unknown } };
          const normalized = normalizeValidationErrors(err.response?.data ?? err);
          await onError?.(normalized, err);
          if (!onError) throw error;
          return;
        }
      }

      if (method === "get" && navigate) {
        const targetPath = routePath ?? route.path;
        if (!preserveState) clearRememberForPath(targetPath);
        const payload = { path: targetPath, query: (query ?? route.query) as LocationQueryRaw };
        if (replace) await router.replace(payload);
        else await router.push(payload);
      }

      await onSuccess?.(response!);
      return response;
    } finally {
      trackEnd();
      await onFinish?.();
      await restoreScroll(preserveScroll, savedY);
    }
  }

  function visit(url: string, options?: GumVisitOptions): Promise<AxiosResponse | undefined>;
  function visit(options: GumVisitOptions & { fetcher: Fetcher }): Promise<AxiosResponse | undefined>;
  function visit(urlOrOptions: string | (GumVisitOptions & { fetcher: Fetcher }), options: GumVisitOptions = {}) {
    if (typeof urlOrOptions === "object") {
      return runVisit({ method: urlOrOptions.method ?? "get", url: undefined, ...urlOrOptions, hooks: urlOrOptions });
    }
    return runVisit({ method: options.method ?? "get", url: urlOrOptions, ...options, hooks: options });
  }

  const api = {
    processing: globalProcessing,
    visit,
    get: (url: string, o: GumVisitOptions = {}) => runVisit({ method: "get", url, ...o, hooks: o }),
    post: (url: string, data?: GumVisitOptions["data"], o: GumVisitOptions = {}) => runVisit({ method: "post", url, data, ...o, hooks: o }),
    put: (url: string, data?: GumVisitOptions["data"], o: GumVisitOptions = {}) => runVisit({ method: "put", url, data, ...o, hooks: o }),
    patch: (url: string, data?: GumVisitOptions["data"], o: GumVisitOptions = {}) =>
      runVisit({ method: "patch", url, data, ...o, hooks: o }),
    delete: (url: string, o: GumVisitOptions = {}) => runVisit({ method: "delete", url, data: o.data, ...o, hooks: o }),
    reload: (o: GumVisitOptions = {}) =>
      runVisit({ method: "get", url: route.path, query: route.query as Record<string, unknown>, replace: true, ...o, hooks: o }),

    getWith: (o: VisitWithFetcherOptions) => runVisit({ method: "get", ...o, hooks: o }),
    postWith: (o: VisitWithFetcherDataOptions) => runVisit({ method: "post", ...o, hooks: o }),
    putWith: (o: VisitWithFetcherDataOptions) => runVisit({ method: "put", ...o, hooks: o }),
    patchWith: (o: VisitWithFetcherDataOptions) => runVisit({ method: "patch", ...o, hooks: o }),
    deleteWith: (o: VisitWithFetcherOptions) => runVisit({ method: "delete", ...o, hooks: o })
  };

  return api;
}

type GumApi = ReturnType<typeof buildVisitApi>;

/* -------------------------------------------------------------------------- */
/* Form                                                                       */
/* -------------------------------------------------------------------------- */

function createForm<T extends Record<string, unknown>>(defaults: T) {
  const initial = structuredClone(defaults);
  const data = reactive(structuredClone(defaults)) as T;
  const errors = reactive<Record<string, string>>({});
  const progress = ref<number | null>(null);
  const formProcessing = ref(false);
  const wasSuccessful = ref(false);
  const recentlySuccessful = ref(false);
  const isDirty = computed(() => JSON.stringify(toRaw(data)) !== JSON.stringify(initial));

  function setError(field: keyof T | string, message: string) {
    errors[String(field)] = message;
  }
  function clearErrors(...fields: (keyof T | string)[]) {
    if (!fields.length) {
      Object.keys(errors).forEach((k) => delete errors[k]);
      return;
    }
    fields.forEach((f) => delete errors[String(f)]);
  }
  function reset(...fields: (keyof T)[]) {
    if (!fields.length) {
      Object.assign(data, structuredClone(initial));
      clearErrors();
      return;
    }
    fields.forEach((f) => {
      (data as any)[f] = structuredClone((initial as any)[f]);
      delete errors[String(f)];
    });
  }

  async function submitForm(method: FormMethod, url: string | undefined, payload: unknown, opts: FormSubmitOptions<T> & GumVisitOptions) {
    const { onBefore, onStart, onProgress, onSuccess, onError, onFinish, validate, transform, fetcher, transport, baseURL, query } =
      opts as any;
    if (!(await runBefore(onBefore))) return;
    if (validate) {
      const v = validate(toRaw(data) as T);
      if (v) {
        clearErrors();
        Object.entries(v).forEach(([k, val]) => (errors[k] = String(val)));
        return;
      }
    }
    clearErrors();
    formProcessing.value = true;
    progress.value = null;
    trackStart();
    try {
      await onStart?.();
      const body = (transform ? transform(toRaw(data) as T) : (payload ?? toRaw(data))) as any;
      const response = await execute({
        method,
        url,
        payload: body,
        query,
        fetcher,
        transport,
        baseURL,
        onProgress: (e) => {
          progress.value = e.total ? Math.round((e.loaded / e.total) * 100) : null;
          onProgress?.(e);
        }
      });
      wasSuccessful.value = true;
      startRecentTimer({ recentlySuccessful });
      await onSuccess?.(response);
      return response;
    } catch (error) {
      const err = error as any;
      const normalized = normalizeValidationErrors(err.response?.data ?? err);
      Object.entries(normalized).forEach(([k, v]) => (errors[k] = Array.isArray(v) ? v[0] : (v as string)));
      await onError?.(normalized, err);
      if (!onError) throw error;
    } finally {
      formProcessing.value = false;
      progress.value = null;
      trackEnd();
      await onFinish?.();
    }
  }

  return {
    data,
    errors: errors as FormErrors<T>,
    progress,
    processing: formProcessing,
    wasSuccessful,
    recentlySuccessful,
    isDirty,
    setError,
    clearErrors,
    reset,
    submit: (method: FormMethod, url: string | undefined, payload?: Record<string, unknown>, opts?: FormSubmitOptions<T>) =>
      submitForm(method, url, payload, opts ?? {}),
    post: (url: string, payload?: Record<string, unknown>, opts?: FormSubmitOptions<T>) => submitForm("post", url, payload, opts ?? {}),
    put: (url: string, payload?: Record<string, unknown>, opts?: FormSubmitOptions<T>) => submitForm("put", url, payload, opts ?? {}),
    patch: (url: string, payload?: Record<string, unknown>, opts?: FormSubmitOptions<T>) => submitForm("patch", url, payload, opts ?? {}),
    delete: (url: string, payload?: Record<string, unknown>, opts?: FormSubmitOptions<T>) => submitForm("delete", url, payload, opts ?? {}),
    postWith: (o: FormWithFetcherOptions<T>) => submitForm("post", undefined, undefined, o),
    putWith: (o: FormWithFetcherOptions<T>) => submitForm("put", undefined, undefined, o),
    patchWith: (o: FormWithFetcherOptions<T>) => submitForm("patch", undefined, undefined, o),
    deleteWith: (o: FormWithFetcherOptions<T>) => submitForm("delete", undefined, undefined, o)
  };
}

type GumForm<T extends Record<string, unknown>> = ReturnType<typeof createForm<T>>;

/* -------------------------------------------------------------------------- */
/* useGum                                                                     */
/* -------------------------------------------------------------------------- */

export function useGum(): GumApi & { form?: undefined };
export function useGum<T extends Record<string, unknown>>(defaults: T): GumApi & { form: GumForm<T> };
export function useGum<T extends Record<string, unknown>>(defaults?: T): GumApi & { form?: GumForm<T> } {
  const api = buildVisitApi();
  if (defaults === undefined) return api as any;
  return { ...api, form: createForm(defaults) } as any;
}

/** @deprecated Use `useGum(defaults).form` instead. */
export function useGumForm<T extends Record<string, unknown>>(defaults: T): GumForm<T> {
  return createForm(defaults);
}

/* -------------------------------------------------------------------------- */
/* Plugin                                                                     */
/* -------------------------------------------------------------------------- */

export const GumPlugin = {
  install(_app: App, options: GumPluginOptions = {}) {
    if (options.rememberPrefix) config.rememberPrefix = options.rememberPrefix;
    if (typeof options.recentlySuccessfulDuration === "number") {
      config.recentlySuccessfulDuration = options.recentlySuccessfulDuration;
    }
    if (options.transport) config.transport = options.transport;
    if (typeof options.baseURL === "string") config.baseURL = options.baseURL;
  }
};
