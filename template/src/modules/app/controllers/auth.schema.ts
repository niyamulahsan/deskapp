// ./src/modules/app/controllers/auth.schema.ts

import { z } from "zod";

/** The sign-in body the renderer sends to `app.auth.login`. */
export const LoginSchema = z.object({
  email: z.string().trim().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional()
});
export type LoginType = z.input<typeof LoginSchema>;
