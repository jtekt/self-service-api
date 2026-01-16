import * as k8s from "@kubernetes/client-node";
import { Env } from "@/config";
import { getDbUsername } from "./uri";
import type { DeploymentParams } from "@/app/api/deploy/stream/route";

const {
  DEPLOY_MODE,
  NODEPORT_EXTERNAL_ADDRESS,
  INGRESS_DOMAIN,
  PGRST_IMAGE,
  PGRST_JWT_CERT_URL,
} = Env;

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

export async function createDeployment(
  params: DeploymentParams,
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
          "app.kubernetes.io/name": name,
        },
      },
      template: {
        metadata: {
          labels: {
            "app.kubernetes.io/name": name,
          },
        },
        spec: {
          containers: [
            {
              name: "postgrest",
              image: PGRST_IMAGE,
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
    if (!PGRST_JWT_CERT_URL) {
      throw new Error("Cannot authenticate without certificate URL");
    }
    const cert = await fetch(PGRST_JWT_CERT_URL);
    if (!cert.ok) {
      throw new Error("Error fetching JWT certificates");
    }
    const certContents = await cert.text();
    deployment.spec?.template.spec?.containers[0].env?.push(
      { name: "PGRST_JWT_SECRET", value: certContents },
      { name: "PGRST_DB_PRE_REQUEST", value: `${schema}.check_user` },
      { name: "PGRST_OPENAPI_SECURITY_ACTIVE", value: "true" },
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
  params: DeploymentParams,
): Promise<k8s.V1Service> {
  const { namespace, name } = params;
  const deployMode = DEPLOY_MODE;

  const service: k8s.V1Service = {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name,
      namespace,
      labels: {
        "app.kubernetes.io/name": name,
      },
    },
    spec: {
      type: deployMode === "nodePort" ? "NodePort" : "ClusterIP",
      selector: {
        "app.kubernetes.io/name": name,
      },
      ports: [
        {
          port: 3000,
          targetPort: 3000,
          protocol: "TCP",
          name: "http",
        },
      ],
    },
  };

  try {
    return await k8sApi.createNamespacedService({
      namespace,
      body: service,
    });
  } catch (error: any) {
    if (error.code !== 409) {
      console.error(error);
      throw error;
    }
    // Update existing resource
    return await k8sApi.replaceNamespacedService({
      namespace,
      name,
      body: service,
    });
  }
}

export async function createIngress(params: DeploymentParams): Promise<string> {
  const { namespace, name } = params;

  if (!INGRESS_DOMAIN) {
    throw new Error("INGRESS_DOMAIN is required for ingress mode");
  }

  const hostname = `${name}.${INGRESS_DOMAIN}`;

  const ingress: k8s.V1Ingress = {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name,
      namespace,
      labels: {
        "app.kubernetes.io/name": name,
      },
    },
    spec: {
      rules: [
        {
          host: hostname,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name,
                    port: {
                      number: 3000,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };

  try {
    await networkingApi.createNamespacedIngress({
      namespace,
      body: ingress,
    });
  } catch (error: any) {
    if (error.code !== 409) {
      console.error(error);
      throw error;
    }
    // Update existing resource
    await networkingApi.replaceNamespacedIngress({
      namespace,
      name,
      body: ingress,
    });
  }

  return hostname;
}

export async function getNodeIp(): Promise<string | undefined> {
  if (NODEPORT_EXTERNAL_ADDRESS) return NODEPORT_EXTERNAL_ADDRESS;
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
