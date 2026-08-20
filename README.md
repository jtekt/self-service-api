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
DEFAULT_READ_ONLY=false

# Prefix for deployed resources
DATABASE_NAME_PREFIX=self-service-api

# Kubernetes namespace
K8S_NAMESPACE=default

# Optional Service overrides
# Type defaults to NodePort/ClusterIP based on DEPLOY_MODE if unset
SERVICE_TYPE=
# JSON object of annotations to add to the Service (e.g. cloud LB config)
SERVICE_ANNOTATIONS=

# Optional help link
HELP_URL=

# URL protocol used in generated endpoints
DEPLOY_PROTOCOL=http
```

---

# NodePort Deployment

Expose APIs directly from cluster nodes.

```env
DEPLOY_MODE=nodePort

# Optional external address of a cluster node
# If empty the node IP will be used
NODE_EXTERNAL_ADDRESS=
```

### Example URL

```
http://<node-ip>:<nodePort>
```

Example

```
http://192.168.1.10:31234
```

---

# Ingress Deployment

Expose APIs through a domain using an ingress controller.

```env
DEPLOY_MODE=ingress

# Base domain used for generated APIs
INGRESS_DOMAIN=subdomain.example.com

# Optional ingress class (e.g. nginx, traefik). Uses the cluster default if unset
INGRESS_CLASS_NAME=

# JSON object of annotations to add to the Ingress (e.g. cert-manager, nginx rewrite rules)
INGRESS_ANNOTATIONS=

# Optional: enables TLS on the Ingress using this pre-existing secret
# (e.g. a wildcard cert covering *.<INGRESS_DOMAIN>)
INGRESS_TLS_SECRET_NAME=
```

### Generated hostname

```
<database-name>.<INGRESS_DOMAIN>
```

Example

```
orders.example.com
```

---

# What the Application Deploys

For every API created:

1. Database connection is validated
2. Schema is inspected
3. PostgREST configuration is generated
4. Kubernetes Deployment is created
5. Service or Ingress is created
6. API endpoint is returned to the user

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
| `MESSAGE`              | No       | —                     | Optional message shown to users in the interface.                             |

## Database Defaults

| Variable            | Required | Default | Description                                                    |
| ------------------- | -------- | ------- | -------------------------------------------------------------- |
| `DEFAULT_HOST`      | No       | —       | Default database host shown in the form.                       |
| `DEFAULT_PORT`      | No       | —       | Default database port. Must be numeric.                        |
| `DEFAULT_READ_ONLY` | No       | `false` | If true, default connection values cannot be edited in the UI. |

## Authentication (OIDC)

| Variable              | Required | Depends On   | Description                                         |
| --------------------- | -------- | ------------ | --------------------------------------------------- |
| `PGRST_JWT_CERT_URL`  | Optional | Auth enabled | JWKS endpoint used to validate JWT tokens.          |
| `PGRST_JWT_CLAIM_KEY` | Optional | Auth enabled | JWT claim used to identify the user (e.g. `email`). |

## Deployment

| Variable          | Required | Default    | Description                               |
| ----------------- | -------- | ---------- | ----------------------------------------- |
| `DEPLOY_MODE`     | No       | `nodePort` | Deployment type: `nodePort` or `ingress`. |
| `DEPLOY_PROTOCOL` | No       | `http`     | Protocol used when generating URLs.       |

### NodePort

| Variable                | Required | Description                                           |
| ------------------------ | -------- | ----------------------------------------------------- |
| `NODE_EXTERNAL_ADDRESS` | Optional | Override the detected node IP used in generated URLs. |

### Service

Applies regardless of `DEPLOY_MODE`.

| Variable               | Required | Default                                    | Description                                                              |
| ----------------------- | -------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| `SERVICE_TYPE`         | No       | `NodePort`/`ClusterIP` based on `DEPLOY_MODE` | Overrides the Service type, e.g. `LoadBalancer`.                          |
| `SERVICE_ANNOTATIONS`  | No       | —                                             | JSON object of annotations added to the Service (e.g. cloud LB config).   |

### Ingress

| Variable                  | Required | Condition                           | Description                                                                          |
| --------------------------- | -------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `INGRESS_DOMAIN`           | Yes*     | Required when `DEPLOY_MODE=ingress` | Base domain used to generate API hostnames.                                              |
| `INGRESS_CLASS_NAME`       | No       | —                                    | Sets `spec.ingressClassName`. Uses the cluster default class if unset.                   |
| `INGRESS_ANNOTATIONS`      | No       | —                                    | JSON object of annotations added to the Ingress (e.g. cert-manager, rewrite rules).      |
| `INGRESS_TLS_SECRET_NAME`  | No       | —                                    | Enables TLS on the Ingress using this pre-existing secret (e.g. a wildcard cert).        |

Example hostname:

```
<database-name>.<INGRESS_DOMAIN>
```
