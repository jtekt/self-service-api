import * as k8s from "@kubernetes/client-node";
import { Env } from "@/config";
import { getDbUsername } from "./uri";
import { AccessControl } from "./validation";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);

export interface K8sDeploymentParams {
  namespace: string;
  name: string;
  dbUri: string;
  schema: string;
  accessControl: AccessControl;
}

export async function createDeployment(
  params: K8sDeploymentParams,
): Promise<void> {
  const { namespace, name, dbUri, schema, accessControl } = params;

  const username_role = getDbUsername(dbUri);

  if (!username_role) {
    throw new Error("Error finding the database username");
  }

  const deployment: k8s.V1Deployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace,
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: name,
          },
        },
        spec: {
          containers: [
            {
              name: "postgrest",
              image: Env.PGRST_IMAGE,
              resources: {
                requests: {
                  memory: "128Mi",
                  cpu: "10m",
                },
                limits: {
                  memory: "512Mi",
                  cpu: "600m",
                },
              },
              env: [
                { name: "PGRST_DB_URI", value: dbUri },
                { name: "PGRST_DB_ANON_ROLE", value: username_role },
                { name: "PGRST_SCHEMAS", value: schema },
                { name: "PGRST_SERVER_PORT", value: "3000" },
                { name: "PGRST_OPENAPI_MODE", value: "ignore-privileges" },
              ],
            },
          ],
        },
      },
    },
  };

  if (accessControl.type !== "public") {
    if (!Env.PGRST_JWT_CERT_URL) {
      throw new Error("Cannot authenticate without certificate URL");
    }

    const cert = await fetch(Env.PGRST_JWT_CERT_URL);

    if (!cert.ok) {
      throw new Error("Error fetching JWT certificates");
    }

    const certContents = await cert.text();

    deployment.spec?.template.spec?.containers[0].env?.push(
      { name: "PGRST_JWT_SECRET", value: certContents },
      { name: "PGRST_DB_PRE_REQUEST", value: `${schema}.check_user` },
    );
  }

  try {
    await appsApi.createNamespacedDeployment({ namespace, body: deployment });
  } catch (error: any) {
    if (error.code !== 409) {
      console.error(error);
      throw error;
    }

    // Update existing resource
    await appsApi.replaceNamespacedDeployment({
      namespace,
      name,
      body: deployment,
    });
  }
}

export async function createService(
  params: K8sDeploymentParams,
): Promise<number | undefined> {
  const { namespace, name } = params;

  const service: k8s.V1Service = {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name,
      namespace,
      labels: {
        app: name,
      },
    },
    spec: {
      type: "NodePort",
      selector: {
        app: name,
      },
      ports: [
        {
          port: 3000,
        },
      ],
    },
  };

  try {
    const response = await k8sApi.createNamespacedService({
      namespace,
      body: service,
    });
    return response.spec?.ports?.[0]?.nodePort || 30000;
  } catch (error: any) {
    if (error.code !== 409) {
      console.error(error);
      throw error;
    }

    // Update existing resource
    const response = await k8sApi.replaceNamespacedService({
      namespace,
      name,
      body: service,
    });
    return response.spec?.ports?.[0]?.nodePort;
  }
}

export async function getNodeIp(): Promise<string | undefined> {
  if (Env.CLUSTER_ACCESS_URI) return Env.CLUSTER_ACCESS_URI;

  const { items } = await k8sApi.listNode();
  const node = items[0];

  const addr =
    node.status?.addresses?.find((a) => a.type === "ExternalIP") ||
    node.status?.addresses?.find((a) => a.type === "InternalIP");

  return addr?.address;
}

export async function waitForDeploymentReady(
  namespace: string,
  name: string,
): Promise<void> {
  for (let i = 0; i < 180; i++) {
    // ~180s max
    const dep = await appsApi.readNamespacedDeployment({ namespace, name });
    const status = dep.status;

    if (status?.readyReplicas === status?.replicas && status?.replicas! > 0) {
      return;
    }

    await new Promise((res) => setTimeout(res, 1000));
  }

  throw new Error(`Deployment ${name} not ready after timeout`);
}
