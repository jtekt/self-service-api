import { NextRequest } from "next/server";
import {
  createDeployment,
  createService,
  getNodeIp,
  K8sDeploymentParams,
  waitForDeploymentReady,
} from "@/lib/k8s";
import { Env } from "@/config";
import { generateAuthFunction } from "@/lib/database";
import z from "zod";
import { AccessControlSchema, PostgresUriSchema } from "@/lib/validation";

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
        const name = (Env.K8S_APP_PREFIX ? Env.K8S_APP_PREFIX + "-" : "") + dbName;

        const params: K8sDeploymentParams = {
          namespace: Env.K8S_NAMESPACE,
          name,
          dbUri: uri,
          schema,
          accessControl,
        };

        // STEP 1
        sendJson({ type: "progress", message: "Creating Database access..." });
        await generateAuthFunction(params.dbUri, params.accessControl);

        // STEP 2
        sendJson({ type: "progress", message: "Creating Deployment..." });
        await createDeployment(params);

        // STEP 3
        sendJson({ type: "progress", message: "Creating Service..." });
        const nodePort = await createService(params);

        // STEP 4
        sendJson({
          type: "progress",
          message: "Waiting for API to become Ready...",
        });
        await waitForDeploymentReady(params.namespace, params.name);

        // FINAL
        let apiUrl: string | undefined = undefined;

        if (nodePort) {
          const nodeIp = await getNodeIp();

          if (nodeIp) {
            apiUrl = `${nodeIp}:${nodePort}`;
          }
        }

        sendJson({
          type: "complete",
          message: "Completed deployment",
          apiUrl,
        });

        controller.close();
      } catch (error: any) {
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
