import "server-only";
import { z } from "zod";

export const EnvSchema = z
  .object({
    // Postgrest config
    PGRST_IMAGE: z.string().trim().min(1).default("postgrest/postgrest"),

    // Postgrest OIDC config
    PGRST_JWT_CERT_URL: z.url().optional(),
    PGRST_JWT_CLAIM_KEY: z.string().trim().min(1).optional(),

    // URI defaults config
    DEFAULT_HOST: z.string().trim().optional(),
    DEFAULT_PORT: z
      .string()
      .trim()
      .regex(/^\d+$/, "DEFAULT_PORT must be a number")
      .optional(),
    DEFAULT_READ_ONLY: z
      .preprocess((val) => {
        if (typeof val === "string") {
          const lower = val.toLowerCase();
          if (lower === "true") return true;
          if (lower === "false") return false;
        }
        return val;
      }, z.boolean())
      .default(false),

    // Database
    DATABASE_NAME_PREFIX: z
      .string()
      .optional()
      .default("self-service-api")
      .transform((value) => {
        if (!value) return undefined;

        // Remove trailing "-"
        return value.endsWith("-") ? value.slice(0, -1) : value;
      }), // Will be set as DATABASE_NAME_PREFIX-databaseName

    // K8s config
    K8S_NAMESPACE: z.string().trim().min(1).default("default"), // Where the apps will be deployed

    // Help
    HELP_URL: z.url().optional(),

    // Deployment
    DEPLOY_MODE: z.enum(["ingress", "nodePort"]).default("nodePort"),
    DEPLOY_PROTOCOL: z.enum(["http", "https"]).default("http"),

    // Deployment - NodePort
    NODEPORT_EXTERNAL_ADDRESS: z.string().trim().optional(), // For NodePort mode (if not set will use the deployed node IP)

    // Deployment - Ingress
    INGRESS_DOMAIN: z.string().trim().optional(), // If ingress use is required

    // Generic message to explain the app if needed
    MESSAGE: z.string().optional()
  })
  .refine(
    (data) => {
      // If using ingress mode, INGRESS_DOMAIN is required
      if (data.DEPLOY_MODE === "ingress" && !data.INGRESS_DOMAIN) {
        return false;
      }
      return true;
    },
    {
      message: "INGRESS_DOMAIN is required when DEPLOY_MODE is 'ingress'",
      path: ["INGRESS_DOMAIN"],
    },
  );

// Parse + apply defaults
export const Env = EnvSchema.parse(process.env);
