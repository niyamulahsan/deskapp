import { describe, expect, it } from "vitest";
import { pass } from "@/core/utils/password";

describe("pass (password utils)", () => {
  it("hashes a password and verifies the correct value", async () => {
    const hash = await pass.hashPassword("super-secret");
    expect(hash).toBeTypeOf("string");
    expect(hash).not.toBe("super-secret");
    expect(hash.startsWith("$2")).toBe(true); // bcrypt

    await expect(pass.verifyPassword("super-secret", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await pass.hashPassword("correct-horse-battery-staple");
    await expect(pass.verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces different hashes for the same password (salted)", async () => {
    const a = await pass.hashPassword("same");
    const b = await pass.hashPassword("same");
    expect(a).not.toBe(b);
    await expect(pass.verifyPassword("same", a)).resolves.toBe(true);
    await expect(pass.verifyPassword("same", b)).resolves.toBe(true);
  });
});
