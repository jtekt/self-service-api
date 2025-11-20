import z from "zod";

export const PostgresUriSchema = z
  .url()
  .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
    message: "Must start with postgres:// or postgresql://",
  });

export const AccessControlSchema = z.object({
  type: z.enum(["public", "authenticated", "specific"]),
  users: z.array(z.string()),
});

export type AccessControl = z.infer<typeof AccessControlSchema>;
