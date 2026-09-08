import type { z as Zod } from "zod";
import { z } from "zod";

/**
 * validate - centralize schema validation with a consistent error shape.
 * Runs safeParseAsync and throws a structured failure on invalid data.
 * Mirrors the engine's `framework/http/validation.ts`.
 *
 * Consumers import from the facade:
 *   import { validate } from "@/core/facade.ts";
 *   const data = await validate.run(CreateUserSchema, body);
 *   const schema = validate.z.object({ name: validate.z.string() });
 */
export const validate = {
  /** zod - build schemas. */
  z,

  /**
   * Validate `data` against a zod schema; throws a structured 422-style
   * failure when invalid, otherwise returns the parsed data.
   */
  async run<T>(schema: Zod.ZodType<T>, data: unknown): Promise<T> {
    const result = await schema.safeParseAsync(data);

    if (!result.success) {
      throw {
        status: 422,
        message: "Validation failed",
        errors: result.error.flatten(),
      };
    }

    return result.data;
  },
};