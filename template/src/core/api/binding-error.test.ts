import { describe, expect, it } from "vitest";
import {
  BINDING_ERROR,
  isBindingErrorEnvelope,
  serializeBindingError,
  toBindingErrorEnvelope,
} from "@/core/api/binding-error";

describe("binding error envelope", () => {
  it("preserves a thrown validate.run-shaped object", () => {
    const thrown = {
      status: 422,
      message: "Validation failed",
      errors: { formErrors: ["bad form"], fieldErrors: { email: ["Invalid email"] } },
    };
    const envelope = toBindingErrorEnvelope(thrown);
    expect(envelope[BINDING_ERROR]).toBe(true);
    expect(envelope.status).toBe(422);
    expect(envelope.message).toBe("Validation failed");
    expect(envelope.errors).toEqual(thrown.errors);
    expect(isBindingErrorEnvelope(envelope)).toBe(true);
  });

  it("captures an Error's message, name and own properties", () => {
    const error = Object.assign(new Error("boom"), { status: 500, code: "E_BOOM" });
    const payload = serializeBindingError(error);
    expect(payload.message).toBe("boom");
    expect(payload.name).toBe("Error");
    expect(payload.status).toBe(500);
    expect(payload.code).toBe("E_BOOM");
  });

  it("stringifies a non-object throw", () => {
    expect(serializeBindingError("nope")).toEqual({ message: "nope" });
  });

  it("does not mistake an ordinary result for an envelope", () => {
    expect(isBindingErrorEnvelope({ ok: true, data: [] })).toBe(false);
    expect(isBindingErrorEnvelope({ __deskappError: false })).toBe(false);
    expect(isBindingErrorEnvelope(null)).toBe(false);
    expect(isBindingErrorEnvelope("x")).toBe(false);
  });
});
