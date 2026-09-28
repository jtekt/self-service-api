import * as k8s from "@kubernetes/client-node";
import { Env } from "@/config";
import { getDbUsername } from "./uri";
import type { DeploymentParams } from "@/app/api/deploy/stream/route";

const {
  DATABASE_NAME_PREFIX,
  API_URL_TEMPLATE,
  INGRESS_CLASS_NAME,
  INGRESS_ANNOTATIONS,
  INGRESS_TLS_SECRET_NAME,
  HTTPROUTE_PARENT_REFS,
  SERVICE_TYPE,
  SERVICE_ANNOTATIONS,
  PGRST_IMAGE,
  PGRST_JWT_CERT_URL,
} = Env;

// Owners of a deployed API, allowed to see, redeploy and delete it: a
// comma-separated list of emails
const OWNER_ANNOTATION = "self-service-api/owner";

// Users the Deployment Manager shows the API to. Written for its sake only:
// ownership is never read from it
const DEPLOYMENT_MANAGER_USERS_ANNOTATION =
  "deployment-manager.jtekt.co.jp/users";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);

const HTTPROUTE = {
  group: "gateway.networking.k8s.io",
  version: "v1",
  plural: "httproutes",
};

const isNotFound = (error: unknown) =>
  (error as { code?: number }).code === 404;

export async function createSecret(
  params: DeploymentParams,
): Promise<k8s.V1Secret> {
  const { namespace, name, dbUri, schema, accessControl } = params;

  const username_role = getDbUsername(dbUri);
  if (!username_role) {
    throw new Error("Error finding the database username");
  }

  // Base secret contents
  const secretData: Record<string, string> = {
    PGRST_DB_URI: dbUri,
    PGRST_DB_ANON_ROLE: username_role,
    PGRST_SCHEMAS: schema,
    PGRST_SERVER_PORT: "3000",
    PGRST_OPENAPI_MODE: "ignore-privileges",
  };

  // Add JWT‑related secrets if access control is not public
  if (accessControl.type !== "public") {
    if (!PGRST_JWT_CERT_URL) {
      throw new Error("Cannot authenticate without certificate URL");
    }

    const cert = await fetch(PGRST_JWT_CERT_URL);
    if (!cert.ok) {
      throw new Error("Error fetching JWT certificates");
    }
    const certContents = await cert.text();

    secretData.PGRST_JWT_SECRET = certContents;
    secretData.PGRST_DB_PRE_REQUEST = `${schema}.check_user`;
    secretData.PGRST_OPENAPI_SECURITY_ACTIVE = "true";
  }

  const secretName = `${name}-env`;

  const secret: k8s.V1Secret = {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: secretName,
      namespace,
    },
    type: "Opaque",
    stringData: secretData,
  };

  try {
    return await coreApi.createNamespacedSecret({ namespace, body: secret });
  } catch (error: any) {
    if (error.code !== 409) {
      console.error(error);
      throw error;
    }
    // Update existing resource
    return await coreApi.replaceNamespacedSecret({
      namespace,
      name: secretName,
      body: secret,
    });
  }
}

export async function createDeployment(
  params: DeploymentParams,
): Promise<k8s.V1Deployment> {
  const { namespace, name, dbUri, user } = params;

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
      annotations: {
        [OWNER_ANNOTATION]: user.email,
        [DEPLOYMENT_MANAGER_USERS_ANNOTATION]: user.email,
      },
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
              envFrom: [{ secretRef: { name: `${name}-env` } }],
            },
          ],
        },
      },
    },
  };

  try {
    return await appsApi.createNamespacedDeployment({
      namespace,
      body: deployment,
    });
  } catch (error: any) {
    if (error.code !== 409) {
      console.error(error);
      throw error;
    }
    // Update existing resource, keeping its owners (e.g. co-owners added by
    // hand) and Deployment Manager users. Callers must have checked
    // ownership with isOwner
    const existing = await appsApi.readNamespacedDeployment({
      namespace,
      name,
    });
    const annotations = deployment.metadata!.annotations!;
    const owners = getOwners(existing);
    if (owners.length) annotations[OWNER_ANNOTATION] = owners.join(",");
    const deploymentManagerUsers =
      existing.metadata?.annotations?.[DEPLOYMENT_MANAGER_USERS_ANNOTATION];
    if (deploymentManagerUsers)
      annotations[DEPLOYMENT_MANAGER_USERS_ANNOTATION] = deploymentManagerUsers;

    return await appsApi.replaceNamespacedDeployment({
      namespace,
      name,
      body: deployment,
    });
  }
}

// Owners' emails, lowercased
function getOwners(deployment: k8s.V1Deployment): string[] {
  const owners = deployment.metadata?.annotations?.[OWNER_ANNOTATION] ?? "";
  return owners
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwner(deployment: k8s.V1Deployment, email: string) {
  return getOwners(deployment).includes(email.toLowerCase());
}

// The API deployed as `name`, or null if there is none. Only returns
// Deployments this app creates (named with DATABASE_NAME_PREFIX)
export async function getApi(
  namespace: string,
  name: string,
): Promise<k8s.V1Deployment | null> {
  if (!name.startsWith(`${DATABASE_NAME_PREFIX}-`)) return null;
  try {
    return await appsApi.readNamespacedDeployment({ namespace, name });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 404) return null;
    throw error;
  }
}

// APIs the user is allowed to manage, newest first
export async function listApisForUser(
  namespace: string,
  email: string,
): Promise<k8s.V1Deployment[]> {
  const { items } = await appsApi.listNamespacedDeployment({ namespace });
  return items
    .filter(
      (deployment) =>
        deployment.metadata?.name?.startsWith(`${DATABASE_NAME_PREFIX}-`) &&
        !deployment.metadata.deletionTimestamp &&
        isOwner(deployment, email),
    )
    .sort(
      (a, b) =>
        new Date(b.metadata?.creationTimestamp ?? 0).getTime() -
        new Date(a.metadata?.creationTimestamp ?? 0).getTime(),
    );
}

// API_URL_TEMPLATE filled in for one API, or undefined if the template is
// unset or needs a node port the API doesn't have
function renderApiUrl(name: string, nodePort?: number): string | undefined {
  if (!API_URL_TEMPLATE) return undefined;
  if (API_URL_TEMPLATE.includes("{nodePort}") && !nodePort) return undefined;
  return API_URL_TEMPLATE.replaceAll("{name}", name).replaceAll(
    "{nodePort}",
    String(nodePort),
  );
}

// Hostname Ingresses and HTTPRoutes serve an API on. config.ts guarantees
// API_URL_TEMPLATE is a URL containing {name} whenever either is enabled
function getApiHostname(name: string): string {
  return new URL(renderApiUrl(name)!).hostname;
}

// Public URL of an API, or undefined if API_URL_TEMPLATE doesn't give one
export async function getApiUrl(
  namespace: string,
  name: string,
  service?: k8s.V1Service,
): Promise<string | undefined> {
  if (!API_URL_TEMPLATE?.includes("{nodePort}")) return renderApiUrl(name);

  try {
    service ??= await coreApi.readNamespacedService({ namespace, name });
  } catch (error: unknown) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
  return renderApiUrl(name, service.spec?.ports?.[0]?.nodePort);
}

// Deletes everything createDeployment & co. created for an API. Callers must
// have checked ownership with isOwner. Missing resources are skipped, so a
// partially deployed or partially deleted API can still be cleaned up
export async function deleteApi(namespace: string, name: string) {
  const ignoreNotFound = (error: unknown) => {
    if (!isNotFound(error)) throw error;
  };
  // Always attempted, so routes left over from an earlier configuration go
  // too. Without HTTPRoute support configured, the cluster may lack the
  // Gateway API or the app the permission for it: skip those errors then
  await customObjectsApi
    .deleteNamespacedCustomObject({ ...HTTPROUTE, namespace, name })
    .catch((error: unknown) => {
      if (isNotFound(error)) return;
      if (!HTTPROUTE_PARENT_REFS && (error as { code?: number }).code === 403)
        return;
      throw error;
    });
  await networkingApi
    .deleteNamespacedIngress({ namespace, name })
    .catch(ignoreNotFound);
  await coreApi
    .deleteNamespacedService({ namespace, name })
    .catch(ignoreNotFound);
  await appsApi
    .deleteNamespacedDeployment({ namespace, name })
    .catch(ignoreNotFound);
  await coreApi
    .deleteNamespacedSecret({ namespace, name: `${name}-env` })
    .catch(ignoreNotFound);
}

export async function createService(
  params: DeploymentParams,
): Promise<k8s.V1Service> {
  const { namespace, name } = params;
  const serviceType = SERVICE_TYPE;

  const service: k8s.V1Service = {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name,
      namespace,
      labels: {
        "app.kubernetes.io/name": name,
      },
      ...(SERVICE_ANNOTATIONS ? { annotations: SERVICE_ANNOTATIONS } : {}),
    },
    spec: {
      type: serviceType,
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
    return await coreApi.createNamespacedService({
      namespace,
      body: service,
    });
  } catch (error: any) {
    if (error.code !== 409) {
      console.error(error);
      throw error;
    }
    // Update existing resource
    return await coreApi.replaceNamespacedService({
      namespace,
      name,
      body: service,
    });
  }
}

export async function createIngress(params: DeploymentParams): Promise<void> {
  const { namespace, name } = params;

  const hostname = getApiHostname(name);

  const ingress: k8s.V1Ingress = {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name,
      namespace,
      labels: {
        "app.kubernetes.io/name": name,
      },
      ...(INGRESS_ANNOTATIONS ? { annotations: INGRESS_ANNOTATIONS } : {}),
    },
    spec: {
      ...(INGRESS_CLASS_NAME ? { ingressClassName: INGRESS_CLASS_NAME } : {}),
      ...(INGRESS_TLS_SECRET_NAME
        ? { tls: [{ hosts: [hostname], secretName: INGRESS_TLS_SECRET_NAME }] }
        : {}),
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
}

export async function createHTTPRoute(params: DeploymentParams) {
  const { namespace, name } = params;

  const httpRoute = {
    apiVersion: `${HTTPROUTE.group}/${HTTPROUTE.version}`,
    kind: "HTTPRoute",
    metadata: {
      name,
      namespace,
      labels: {
        "app.kubernetes.io/name": name,
      },
    } as k8s.V1ObjectMeta,
    spec: {
      parentRefs: HTTPROUTE_PARENT_REFS,
      hostnames: [getApiHostname(name)],
      rules: [{ backendRefs: [{ name, port: 3000 }] }],
    },
  };

  try {
    await customObjectsApi.createNamespacedCustomObject({
      ...HTTPROUTE,
      namespace,
      body: httpRoute,
    });
  } catch (error: unknown) {
    if ((error as { code?: number }).code !== 409) {
      console.error(error);
      throw error;
    }
    // Update existing resource. Unlike built-in resources, custom resources
    // can only be replaced with their current resourceVersion
    const existing = (await customObjectsApi.getNamespacedCustomObject({
      ...HTTPROUTE,
      namespace,
      name,
    })) as { metadata?: k8s.V1ObjectMeta };
    httpRoute.metadata.resourceVersion = existing.metadata?.resourceVersion;
    await customObjectsApi.replaceNamespacedCustomObject({
      ...HTTPROUTE,
      namespace,
      name,
      body: httpRoute,
    });
  }
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
