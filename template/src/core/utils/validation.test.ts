import { describe, expect, it } from "vitest";
import { validate } from "@/core/utils/validation";

describe("validate (zod runner)", () => {
  const UserSchema = validate.z.object({
    name: validate.z.string().min(1),
    age: validate.z.coerce.number().int().positive(),
  });

  it("parses and returns valid data", async () => {
    const result = await validate.run(UserSchema, { name: "Ada", age: 30 });
    expect(result).toEqual({ name: "Ada", age: 30 });
  });

  it("coerces values via the schema", async () => {
    const result = await validate.run(UserSchema, { name: "Ada", age: "42" });
    expect(result.age).toBe(42);
  });

  it("throws a structured 422-style error on invalid data", async () => {
    await expect(validate.run(UserSchema, { name: "", age: -1 })).rejects.toMatchObject({
      status: 422,
      message: "Validation failed",
      errors: expect.any(Object),
    });
  });
});
