import z from "zod";

export const connectionSchema = z.object({
  host: z.string().trim().min(1, "Host is required"),
  port: z.string().trim().regex(/^\d+$/, "Port must be a number"),
  user: z.string().trim().min(1, "User is required"),
  password: z.string().trim().min(1, "Password is required"),
  database: z.string().trim().min(1, "Database name is required"),
  ssl: z.boolean(),
});

export const PostgresUriSchema = z
  .url()
  .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
    message: "Must start with postgres:// or postgresql://",
  });

export const AccessControlSchema = z.object({
  type: z.enum(["public", "authenticated", "specific"]),
  users: z.array(z.string().trim()),
});

export type ConnectionSchema = z.infer<typeof connectionSchema>;
export type AccessControl = z.infer<typeof AccessControlSchema>;
