import { NextRequest } from "next/server";
import {
  createDeployment,
  createService,
  createIngress,
  createHTTPRoute,
  getApiUrl,
  waitForDeploymentReady,
  createSecret,
  getApi,
  isOwner,
} from "@/lib/k8s";
import { Env } from "@/config";
import { generateAuthFunction, generateDocsFunction } from "@/lib/database";
import z from "zod";
import {
  AccessControl,
  AccessControlSchema,
  PostgresUriSchema,
} from "@/lib/validation";
import { toK8sName } from "@/utils/k8s";
import { auth } from "@/auth";

export interface DeploymentParams {
  namespace: string;
  name: string;
  dbUri: string;
  schema: string;
  accessControl: AccessControl;
  user: { email: string };
}

const {
  DATABASE_NAME_PREFIX,
  K8S_NAMESPACE,
  INGRESS_CLASS_NAME,
  HTTPROUTE_PARENT_REFS,
} = Env;

const BodySchema = z.object({
  uri: PostgresUriSchema,
  schema: z.string().trim(),
  accessControl: AccessControlSchema,
});

export async function POST(request: NextRequest) {
  const session = await auth();

  const userEmail = session?.user?.email;

  if (!userEmail) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendJson = (obj: any) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        const body = await request.json();
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          throw new Error(z.treeifyError(parsed.error).errors.join(" | "));
        }
        const { accessControl, schema, uri } = parsed.data;

        // Get database from connection string
        const urlObj = new URL(uri);
        const pathname = urlObj.pathname.replace(/^\//, "");
        const dbName = pathname || "default";

        // Add prefix in name if exist
        const k8sSafeName = toK8sName(dbName);
        const name = DATABASE_NAME_PREFIX + "-" + k8sSafeName;
        const params: DeploymentParams = {
          namespace: K8S_NAMESPACE,
          name,
          dbUri: uri,
          schema,
          accessControl,
          user: { email: userEmail },
        };

        // Names come from the database name alone, so another user's
        // database with the same name maps to the same API: never let them
        // overwrite it. Checked before anything is written.
        const existing = await getApi(K8S_NAMESPACE, name);
        if (existing && !isOwner(existing, userEmail)) {
          throw new Error(
            `An API named "${name}" already exists and belongs to another user. Deploy from a database with a different name.`,
          );
        }

        // STEP 1
        sendJson({ type: "progress", message: "Creating Database access..." });
        await generateAuthFunction(params);

        // STEP 2
        sendJson({ type: "progress", message: "Creating API docs..." });
        await generateDocsFunction(params);

        // STEP 3
        sendJson({ type: "progress", message: "Creating Secret..." });
        await createSecret(params);

        // STEP 3
        sendJson({ type: "progress", message: "Creating Deployment..." });
        await createDeployment(params);

        // STEP 4
        sendJson({ type: "progress", message: "Creating Service..." });
        const service = await createService(params);

        // STEP 5
        if (INGRESS_CLASS_NAME) {
          sendJson({ type: "progress", message: "Creating Ingress..." });
          await createIngress(params);
        }
        if (HTTPROUTE_PARENT_REFS) {
          sendJson({ type: "progress", message: "Creating HTTPRoute..." });
          await createHTTPRoute(params);
        }

        // STEP 6
        sendJson({
          type: "progress",
          message: "Waiting for API to become Ready...",
        });
        await waitForDeploymentReady(params.namespace, params.name);

        const apiUrl = await getApiUrl(params.namespace, params.name, service);

        sendJson({
          type: "complete",
          message: "Deployment completed successfully",
          apiUrl,
        });

        controller.close();
      } catch (error: any) {
        console.log(error);
        sendJson({
          type: "error",
          message: error?.message ?? "Deployment failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson", // JSON streaming format
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
