const { z } = require("zod");

// Password must be at least 8 chars and contain upper, lower, number, and special char.
const passwordRules = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/[0-9]/, "Must include a number")
  .regex(/[^A-Za-z0-9]/, "Must include a special character");

const signupBody = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(80, "Name is too long")
      .transform((v) => v.trim()),
    email: z
      .string()
      .email("Valid email is required")
      .transform((v) => v.toLowerCase().trim()),
    password: passwordRules.optional(),
    googleId: z.string().optional(),
  })
  .strict()
  .refine((data) => data.password || data.googleId, {
    message: "Password is required for local signup",
    path: ["password"],
  });

const loginBody = z
  .object({
    email: z
      .string()
      .email("Valid email is required")
      .transform((v) => v.toLowerCase().trim()),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

const updateMeBody = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty")
      .max(80, "Name is too long")
      .optional(),
    email: z
      .string()
      .email("Valid email is required")
      .transform((v) => v.toLowerCase().trim())
      .optional(),
    password: passwordRules.optional(),
  })
  .strict();

const signupSchema = z.object({ body: signupBody });
const loginSchema = z.object({ body: loginBody });
const updateMeSchema = z.object({ body: updateMeBody });

const forgotPasswordSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .email("Valid email is required")
        .transform((v) => v.toLowerCase().trim()),
    })
    .strict(),
});

const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z
        .string()
        .length(64, "Invalid reset token")
        .regex(/^[a-f0-9]+$/, "Invalid reset token"),
      password: passwordRules,
    })
    .strict(),
});

const googleSchema = z.object({
  body: z
    .object({
      credential: z.string().min(1, "credential is required"),
    })
    .strict(),
});

module.exports = {
  signupSchema,
  loginSchema,
  updateMeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleSchema,
};
