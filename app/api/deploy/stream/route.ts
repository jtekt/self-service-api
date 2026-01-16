import { NextRequest } from "next/server";
import {
  createDeployment,
  createService,
  createIngress,
  getNodeIp,
  waitForDeploymentReady,
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

export interface DeploymentParams {
  namespace: string;
  name: string;
  dbUri: string;
  schema: string;
  accessControl: AccessControl;
}

const {
  DATABASE_NAME_PREFIX,
  K8S_NAMESPACE,
  DEPLOY_MODE,
  DEPLOY_PROTOCOL,
  NODEPORT_EXTERNAL_ADDRESS,
} = Env;

const BodySchema = z.object({
  uri: PostgresUriSchema,
  schema: z.string(),
  accessControl: AccessControlSchema,
});

export async function POST(request: NextRequest) {
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
        const name = DATABASE_NAME_PREFIX + "-" + k8sSafeName
        const params: DeploymentParams = {
          namespace: K8S_NAMESPACE,
          name,
          dbUri: uri,
          schema,
          accessControl,
        };

        // STEP 1
        sendJson({ type: "progress", message: "Creating Database access..." });
        await generateAuthFunction(params);

        // STEP 2
        sendJson({ type: "progress", message: "Creating API docs..." });
        await generateDocsFunction(params);

        // STEP 3
        sendJson({ type: "progress", message: "Creating Deployment..." });
        await createDeployment(params);

        let apiUrl: string | undefined = undefined;

        // STEP 4
        sendJson({ type: "progress", message: "Creating Service..." });
        const service = await createService(params);

        const nodePort = service.spec?.ports?.[0]?.nodePort;
        const protocol = DEPLOY_PROTOCOL;

        // STEP 5
        if (DEPLOY_MODE === "ingress") {
          sendJson({ type: "progress", message: "Creating Ingress..." });
          const hostname = await createIngress(params);
          apiUrl = `${protocol}://${hostname}`;
        }

        // STEP 6
        sendJson({
          type: "progress",
          message: "Waiting for API to become Ready...",
        });
        await waitForDeploymentReady(params.namespace, params.name);

        // FINAL - Set apiUrl for NodePort mode if not already set
        if (DEPLOY_MODE === "nodePort" && nodePort) {
          if (NODEPORT_EXTERNAL_ADDRESS) {
            apiUrl = `${protocol}://${NODEPORT_EXTERNAL_ADDRESS}:${nodePort}`;
          } else {
            const nodeIp = await getNodeIp();
            if (nodeIp) {
              apiUrl = `${protocol}://${nodeIp}:${nodePort}`;
            }
          }
        }

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
