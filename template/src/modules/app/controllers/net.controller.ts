/**
 * net.controller.ts (app module) - backend proxy for server API calls.
 *
 * The webview's own fetch() can be blocked by CORS on cross-origin APIs.
 * Calling the API on the Deno backend avoids CORS entirely: the frontend asks
 * `app.net.fetchJson(url)`, the backend fetches it, and the JSON-safe payload
 * comes back through the bindings. The two demo handlers:
 *
 *   fetchJson(url) -> app.net.fetchJson    any http(s) URL (JSON or text)
 *   placeholder()  -> app.net.placeholder  jsonplaceholder.typicode.com
 *
 * See src/ui/src/App.vue for the matching "Server / API" demo section.
 */

const MAX_BODY = 50_000;

/** Proxy one http(s) fetch from the backend; returns JSON (or text) safely. */
export const fetchJson = async (url: string | undefined): Promise<Record<string, unknown>> => {
  const clean = (url ?? "").trim();
  if (!/^https?:\/\//i.test(clean)) {
    return { ok: false, action: "fetch", error: "enter a valid http(s) URL" };
  }
  try {
    const res = await fetch(clean, { headers: { Accept: "application/json" } });
    const text = await res.text();
    let data: unknown;
    if (text.length <= MAX_BODY) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    } else {
      data = `${text.slice(0, 2000)}... (truncated, ${text.length} bytes)`;
    }
    return { ok: res.ok, status: res.status, url: clean, bytes: text.length, data };
  } catch (error) {
    return { ok: false, action: "fetch", url: clean, error: String(error) };
  }
};

/** One-click demo against JSONPlaceholder (no input needed). */
export const placeholder = async (): Promise<Record<string, unknown>> => {
  return await fetchJson("https://jsonplaceholder.typicode.com/todos/1");
};

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = { fetchJson, placeholder };