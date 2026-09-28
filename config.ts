import "server-only";
import { z } from "zod";

const boolSchema = z
  .preprocess((val) => {
    if (typeof val === "string") {
      const lower = val.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
    }
    return val;
  }, z.boolean())
  .default(false);

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

// Accepts a JSON array of Gateway API parentRefs, e.g.
// [{"name":"eg","namespace":"envoy-gateway-system"}]
const parentRefsSchema = z
  .string()
  .trim()
  .optional()
  .transform((val, ctx) => {
    if (!val) return undefined;
    const parsed = z
      .array(
        z.object({
          name: z.string().min(1),
          namespace: z.string().min(1).optional(),
          sectionName: z.string().min(1).optional(),
          port: z.number().int().optional(),
        }),
      )
      .min(1)
      .safeParse(
        (() => {
          try {
            return JSON.parse(val);
          } catch {
            return undefined;
          }
        })(),
      );
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message:
          'must be a JSON array of parentRefs, e.g. [{"name":"eg","namespace":"envoy-gateway-system"}]',
      });
      return z.NEVER;
    }
    return parsed.data;
  });

// Fills an API_URL_TEMPLATE with dummy values, to validate it as a URL
const sampleUrl = (template: string) =>
  template.replaceAll("{name}", "api").replaceAll("{nodePort}", "30000");

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
    SERVICE_TYPE: z.preprocess(
      (val) => (val === "" ? undefined : val), // "SERVICE_TYPE=" in .env
      z.enum(["ClusterIP", "NodePort", "LoadBalancer"]).default("ClusterIP"),
    ),
    SERVICE_ANNOTATIONS: jsonAnnotationsSchema,

    // Help
    HELP_URL: z.url().optional(),

    // Apps portal
    APPS_URL: z.url().optional(),

    // URL shown to users. {name} is the API's name (also its Kubernetes
    // resources' name); {nodePort} its Service's node port, for NodePort
    // setups. Ingress and HTTPRoute hostnames come from it
    API_URL_TEMPLATE: z.string().trim().optional(),

    // Ingress: created only if INGRESS_CLASS_NAME is set
    INGRESS_CLASS_NAME: z.string().trim().optional(), // e.g. "nginx", "traefik"
    INGRESS_ANNOTATIONS: jsonAnnotationsSchema,
    INGRESS_TLS_SECRET_NAME: z.string().trim().optional(), // Enables TLS on the Ingress using this pre-existing secret (e.g. a wildcard cert)

    // HTTPRoute (Gateway API): created only if HTTPROUTE_PARENT_REFS is set
    HTTPROUTE_PARENT_REFS: parentRefsSchema,

    // Generic message to explain the app if needed
    MESSAGE: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const template = data.API_URL_TEMPLATE;
    const routed = !!data.INGRESS_CLASS_NAME || !!data.HTTPROUTE_PARENT_REFS;

    if (template) {
      if (!URL.canParse(sampleUrl(template)))
        ctx.addIssue({
          code: "custom",
          path: ["API_URL_TEMPLATE"],
          message: "must be a URL, e.g. https://{name}.example.com",
        });
      if (template.includes("{nodePort}") && data.SERVICE_TYPE !== "NodePort")
        ctx.addIssue({
          code: "custom",
          path: ["API_URL_TEMPLATE"],
          message: "{nodePort} requires SERVICE_TYPE=NodePort",
        });
    }

    // Ingress and HTTPRoute serve each API on its own hostname
    if (routed && !template?.includes("{name}"))
      ctx.addIssue({
        code: "custom",
        path: ["API_URL_TEMPLATE"],
        message:
          "must contain {name} when INGRESS_CLASS_NAME or HTTPROUTE_PARENT_REFS is set, e.g. https://{name}.example.com",
      });
    if (routed && template?.includes("{nodePort}"))
      ctx.addIssue({
        code: "custom",
        path: ["API_URL_TEMPLATE"],
        message:
          "cannot contain {nodePort} when INGRESS_CLASS_NAME or HTTPROUTE_PARENT_REFS is set",
      });
  });

// Parse + apply defaults
export const Env = EnvSchema.parse(process.env);
