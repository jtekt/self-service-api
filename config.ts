import { z } from "zod";

export const EnvSchema = z.object({
  PGRST_IMAGE: z.string().min(1).default("postgrest/postgrest"),
  PGRST_JWT_CERT_URL: z.url().optional(),   // optional
  PGRST_JWT_CLAIM_KEY: z.string().min(1).optional(), // optional
  K8S_NAMESPACE: z.string().min(1).default("default"),
  CLUSTER_ACCESS_URI: z.url().optional(),              // required
});

// Parse + apply defaults
export const Env = EnvSchema.parse(process.env);
