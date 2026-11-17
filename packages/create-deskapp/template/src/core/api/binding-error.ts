/**
 * Error envelopes for the bindings bridge.
 *
 * Electron's `ipcRenderer.invoke` cannot carry a thrown value across the IPC
 * boundary: it serializes the rejection down to a single string message, so
 * every custom property (`status`, `errors`, …) is lost. A controller that
 * throws `validate.run`'s `{ status: 422, errors }` would reach the renderer as
 * `Error("Error invoking remote method '…': [object Object]")`, and
 * `form.errors.<field>` would never populate.
 *
 * To keep the data, `bindAll` catches handler failures and **returns** this
 * tagged envelope instead of throwing; the preload bridge detects the tag and
 * rejects with an `Error` carrying `.response.data = envelope`, which is the
 * shape `gum` reads. See `guide/gum.md`.
 */

export const BINDING_ERROR = "__deskappError" as const;

/** Structured-clone-safe payload carried by a binding error envelope. */
export interface BindingErrorPayload {
  message: string;
  [key: string]: unknown;
}

/** A serialized handler error, tagged so the preload bridge can spot it. */
export type BindingErrorEnvelope = BindingErrorPayload & { __deskappError: true };

/** True when a handler's resolved value is actually a serialized error. */
export function isBindingErrorEnvelope(value: unknown): value is BindingErrorEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>)[BINDING_ERROR] === true
  );
}

/** Flatten any thrown value into a cloneable payload (own props + message/stack). */
export function serializeBindingError(error: unknown): BindingErrorPayload {
  if (error instanceof Error) {
    const payload: BindingErrorPayload = { message: error.message };
    if (error.name) payload.name = error.name;
    if (error.stack) payload.stack = error.stack;
    for (const key of Object.keys(error)) {
      payload[key] = (error as unknown as Record<string, unknown>)[key];
    }
    return payload;
  }
  if (typeof error === "object" && error !== null) {
    const source = error as Record<string, unknown>;
    const message = typeof source.message === "string" ? source.message : String(error);
    return { ...source, message };
  }
  return { message: String(error) };
}

/** Wrap a thrown value in the tagged envelope `bindAll` returns. */
export function toBindingErrorEnvelope(error: unknown): BindingErrorEnvelope {
  return { [BINDING_ERROR]: true, ...serializeBindingError(error) };
}
