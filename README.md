# Self-Service API

A lightweight UI to deploy PostgREST APIs on a Kubernetes cluster.

The application allows users to:

1. Connect to a PostgreSQL database
2. Select a schema
3. Configure API access
4. Deploy a PostgREST instance automatically
5. Get a ready-to-use API endpoint

---

# Quick Deploy

## 1. Create environment file

Copy the example configuration:

```bash
cp .env.example .env
```

Edit the values based on your infrastructure.

---

# .env.example

## Common configuration

Used for both NodePort and Ingress deployments.

```env
# PostgREST image
PGRST_IMAGE=postgrest/postgrest

# Optional OIDC configuration
PGRST_JWT_CERT_URL=
PGRST_JWT_CLAIM_KEY=email

# Default database values shown in UI
DEFAULT_HOST=postgres
DEFAULT_PORT=5432
DEFAULT_SSL=false
DEFAULT_READ_ONLY=false

# Prefix for deployed resources
DATABASE_NAME_PREFIX=self-service-api

# Kubernetes namespace
K8S_NAMESPACE=default

# Login (Auth.js / next-auth v5, generic OIDC provider)
AUTH_OIDC_ID=
AUTH_OIDC_SECRET=
AUTH_OIDC_ISSUER=
AUTH_SECRET=
AUTH_URL=

# Optional help link
HELP_URL=

# Optional link to the apps portal
APPS_URL=
```

---

# Exposing the APIs

Each deployed API gets a Service. Whether it also gets an Ingress, an HTTPRoute or both is set independently, so both can run side by side while migrating from Ingress to Gateway API:

- **Service:** always created. `SERVICE_TYPE` is `ClusterIP` by default, or `NodePort` or `LoadBalancer`.
- **Ingress:** created when `INGRESS_CLASS_NAME` is set.
- **HTTPRoute:** created when `HTTPROUTE_PARENT_REFS` is set.

`API_URL_TEMPLATE` is the URL shown to users. `{name}` is replaced with the API's name (`<DATABASE_NAME_PREFIX>-<databaseName>`, also the name of its Kubernetes resources), and `{nodePort}` with its Service's node port. Ingresses and HTTPRoutes serve the API on the template's hostname. The app refuses to start if the combination doesn't make sense, e.g. an Ingress or HTTPRoute with a template lacking `{name}`.

```env
# Ingress and HTTPRoute side by side
API_URL_TEMPLATE=https://{name}.example.com
INGRESS_CLASS_NAME=nginx
INGRESS_TLS_SECRET_NAME=wildcard-example-com
HTTPROUTE_PARENT_REFS=[{"name":"eg","namespace":"envoy-gateway-system"}]
```

```env
# No ingress controller: expose APIs on a node's port
SERVICE_TYPE=NodePort
API_URL_TEMPLATE=http://10.0.0.5:{nodePort}
```

```env
# Cloud load balancer
SERVICE_TYPE=LoadBalancer
SERVICE_ANNOTATIONS={"service.beta.kubernetes.io/aws-load-balancer-scheme":"internet-facing"}
```

With HTTPRoutes, TLS is configured on the Gateway's listener, which must also accept routes from `K8S_NAMESPACE` (`allowedRoutes.namespaces`).

---

# What the Application Deploys

For every API created:

1. Database connection is validated
2. Schema is inspected
3. PostgREST configuration is generated
4. Kubernetes Deployment is created
5. Service, and Ingress and/or HTTPRoute, are created
6. API endpoint is returned to the user

---

# Ownership

Each API is named after the database in the connection string (`<DATABASE_NAME_PREFIX>-<databaseName>`), so two databases with the same name map to the same API. The user who first deploys a name owns it: their email is stored in the Deployment's `self-service-api/owner` annotation, a comma-separated list of emails. Only users in that list can redeploy an existing API. Redeploying keeps the list as it is, so co-owners can be added by editing the annotation.

Each Deployment also gets a `deployment-manager.jtekt.co.jp/users` annotation, so the API shows up in the Deployment Manager. The app never reads it for ownership.

The same list decides what users see under **Your APIs** (`/apis`): each API's status, URL and documentation link, and a **Delete** button. Deleting removes the API's Ingress, Service, Deployment and Secret. The database is untouched, including the helper functions the app created in it (the access check and `docs`), since the app does not keep database credentials.

---

# Access Modes

The deployed API can be configured as:

* public
* authenticated (OIDC required)
* specific users

Authentication relies on the JWT claim defined by:

```
PGRST_JWT_CLAIM_KEY
```

If authentication is enabled you must provide:

```
PGRST_JWT_CERT_URL
```

# Environment Variables Reference

## Core

| Variable               | Required | Default               | Description                                                                   |
| ---------------------- | -------- | --------------------- | ----------------------------------------------------------------------------- |
| `PGRST_IMAGE`          | No       | `postgrest/postgrest` | PostgREST Docker image used for deployments.                                  |
| `K8S_NAMESPACE`        | No       | `default`             | Kubernetes namespace where services are deployed.                             |
| `DATABASE_NAME_PREFIX` | No       | `self-service-api`    | Prefix for generated resources. Final name becomes `<prefix>-<databaseName>`. |
| `HELP_URL`             | No       | —                     | Optional documentation link displayed in the UI.                              |
| `APPS_URL`             | No       | —                     | Optional link to the apps portal displayed in the UI.                         |
| `MESSAGE`              | No       | —                     | Optional message shown to users in the interface.                             |

## Login (Auth.js / next-auth v5)

Users sign in to this app through a generic OIDC provider. The login only controls who can use the app. Deployed APIs are not scoped per user.

| Variable           | Required | Description                                       |
| ------------------ | -------- | ------------------------------------------------- |
| `AUTH_OIDC_ID`     | Yes      | OIDC client ID.                                   |
| `AUTH_OIDC_SECRET` | Yes      | OIDC client secret.                               |
| `AUTH_OIDC_ISSUER` | Yes      | OIDC issuer URL.                                  |
| `AUTH_SECRET`      | Yes      | Secret used by Auth.js to sign session tokens.    |
| `AUTH_URL`         | No       | Public URL of this app (used for OAuth callbacks). |

## Database Defaults

| Variable            | Required | Default | Description                                                    |
| ------------------- | -------- | ------- | -------------------------------------------------------------- |
| `DEFAULT_HOST`      | No       | —       | Default database host shown in the form.                       |
| `DEFAULT_PORT`      | No       | —       | Default database port. Must be numeric.                        |
| `DEFAULT_SSL`       | No       | `false` | Default value of the SSL option in the form.                   |
| `DEFAULT_READ_ONLY` | No       | `false` | If true, default connection values cannot be edited in the UI. |

## Authentication (OIDC)

| Variable              | Required | Depends On   | Description                                         |
| --------------------- | -------- | ------------ | --------------------------------------------------- |
| `PGRST_JWT_CERT_URL`  | Optional | Auth enabled | JWKS endpoint used to validate JWT tokens.          |
| `PGRST_JWT_CLAIM_KEY` | Optional | Auth enabled | JWT claim used to identify the user (e.g. `email`). |

## Exposure

See [Exposing the APIs](#exposing-the-apis).

| Variable                  | Default     | Description                                                                                            |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `SERVICE_TYPE`            | `ClusterIP` | `ClusterIP`, `NodePort` or `LoadBalancer`.                                                             |
| `SERVICE_ANNOTATIONS`     | —           | JSON object of annotations added to the Service (e.g. cloud LB config).                                |
| `API_URL_TEMPLATE`        | —           | URL shown to users, with `{name}` and (NodePort only) `{nodePort}`. Required for Ingress and HTTPRoute. |
| `INGRESS_CLASS_NAME`      | —           | Creates an Ingress with this `spec.ingressClassName`. No Ingress if unset.                             |
| `INGRESS_ANNOTATIONS`     | —           | JSON object of annotations added to the Ingress (e.g. cert-manager, rewrite rules).                    |
| `INGRESS_TLS_SECRET_NAME` | —           | Enables TLS on the Ingress using this pre-existing secret (e.g. a wildcard cert).                      |
| `HTTPROUTE_PARENT_REFS`   | —           | Creates an HTTPRoute attached to these Gateways (JSON array of parentRefs). No HTTPRoute if unset.     |

# Deployment

A release is a `vX.Y.Z` tag on `main`. GitLab CI (`.gitlab-ci.yml`) builds the Docker image, pushes it to public ECR as [`public.ecr.aws/jtekt-corporation/self-service-api`](https://gallery.ecr.aws/jtekt-corporation/self-service-api) (`:<tag>` and `:latest`), and applies `kubernetes_manifest.yml` to the cluster. Pushing `main` without a tag deploys nothing.
