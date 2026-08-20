import "server-only";
import { z } from "zod";

const boolSchema =z
      .preprocess((val) => {
        if (typeof val === "string") {
          const lower = val.toLowerCase();
          if (lower === "true") return true;
          if (lower === "false") return false;
        }
        return val;
      }, z.boolean())
      .default(false)

// Accepts a JSON object of string key/values, e.g. {"cert-manager.io/cluster-issuer":"letsencrypt"}
const jsonAnnotationsSchema = z
  .string()
  .trim()
  .optional()
  .transform((val, ctx) => {
    if (!val) return undefined;
    try {
      const parsed = JSON.parse(val);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error("not an object");
      }
      return parsed as Record<string, string>;
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "must be a valid JSON object of string key/values",
      });
      return z.NEVER;
    }
  });

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
    DEFAULT_SSL: boolSchema,
    DEFAULT_READ_ONLY: boolSchema,

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

    // Service config
    SERVICE_TYPE: z.enum(["ClusterIP", "NodePort", "LoadBalancer"]).optional(), // Overrides the type derived from DEPLOY_MODE
    SERVICE_ANNOTATIONS: jsonAnnotationsSchema,

    // Help
    HELP_URL: z.url().optional(),

    // Deployment
    DEPLOY_MODE: z.enum(["ingress", "nodePort"]).default("nodePort"),
    DEPLOY_PROTOCOL: z.enum(["http", "https"]).default("http"),

    // Deployment - NodePort
    NODE_EXTERNAL_ADDRESS: z.string().trim().optional(), // For NodePort mode (if not set will use the detected node IP)

    // Deployment - Ingress
    INGRESS_DOMAIN: z.string().trim().optional(), // If ingress use is required
    INGRESS_CLASS_NAME: z.string().trim().optional(), // e.g. "nginx", "traefik"
    INGRESS_ANNOTATIONS: jsonAnnotationsSchema,
    INGRESS_TLS_SECRET_NAME: z.string().trim().optional(), // Enables TLS on the Ingress using this pre-existing secret (e.g. a wildcard cert covering INGRESS_DOMAIN)

    // Generic message to explain the app if needed
    MESSAGE: z.string().optional(),
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
