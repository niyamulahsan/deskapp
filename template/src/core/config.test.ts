import { afterEach, describe, expect, it } from "vitest";
import { envBool } from "@/core/config";

afterEach(() => {
  delete process.env.__TEST_BOOL__;
});

describe("envBool", () => {
  it("returns fallback when unset", () => {
    delete process.env.__TEST_BOOL__;
    expect(envBool("__TEST_BOOL__", true)).toBe(true);
    expect(envBool("__TEST_BOOL__", false)).toBe(false);
  });

  it("parses truthy values", () => {
    for (const v of ["1", "true", "yes", "on", "TRUE", " Yes "]) {
      process.env.__TEST_BOOL__ = v;
      expect(envBool("__TEST_BOOL__", false)).toBe(true);
    }
  });

  it("parses falsy/other values as false", () => {
    for (const v of ["0", "false", "no", "off", "nope", ""]) {
      process.env.__TEST_BOOL__ = v;
      expect(envBool("__TEST_BOOL__", true)).toBe(false);
    }
  });
});
