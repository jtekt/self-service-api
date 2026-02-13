# Self-service API

A lightweight UI to deploy **PostgREST** services on a **Kubernetes cluster**.

This application allows users to self‑service the creation of a PostgREST API by:

1. **Connecting to PostgreSQL** (providing a database URI)
2. **Selecting a schema** from the connected database
3. **Configuring access rules** (public, authenticated, or user‑restricted)
4. **Deploying a dedicated PostgREST instance** inside the same Kubernetes cluster
5. **Receiving a ready-to-use API URL**

---

## 🔐 Access Control

Choose how your generated API should authenticate:

- **`public`** — No authentication required
- **`authenticated`** — Requires any valid OIDC JWT
- **`specific`** — Only selected OIDC users are allowed

For authenticated modes, the application uses the JWT claim defined by:

```
PGRST_JWT_CLAIM_KEY
```

> **Note:** Authentication requires `PGRST_JWT_CERT_URL`, which should point to a JWKS endpoint  
> (e.g. Keycloak: `/realms/<realm>/protocol/openid-connect/certs`)

The application fetches the public certificates and injects them into PostgREST as `PGRST_JWT_SECRET`.

---

## 📦 Deployment Flow

Once configured, the UI triggers these steps:

1. Validate connection and introspect database schema
2. Generate PostgREST authentication SQL helpers
3. Generate OpenAPI documentation functions
4. Create a Kubernetes **Deployment**
5. Create either:
   - A **NodePort Service** — direct node access
   - An **Ingress** — domain-based API access
6. Wait until the deployment is ready
7. Return the final **Base URL** and **Documentation URL**

### Example URLs

#### NodePort mode:

```
http://<node-ip>:<nodePort>
```

#### Ingress mode:

```
https://<subdomain-prefix><dbname>.<INGRESS_DOMAIN>
```

---

## ⚙️ Environment Variables

Below are all supported environment variables with updated naming:

| Variable                    | Description                                                   | Example                                                      |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| `PGRST_IMAGE`               | PostgREST Docker image used for deployments                   | `postgrest/postgrest`                                        |
| `PGRST_JWT_CERT_URL`        | JWKS / certificate URL for validating JWTs                    | `http://keycloak/realms/realm/protocol/openid-connect/certs` |
| `PGRST_JWT_CLAIM_KEY`       | JWT claim that identifies the user                            | `email` or `preferred_username`                              |
| `DEFAULT_HOST`              | Form database host default value                              | `postgres`                                                   |
| `DEFAULT_PORT`              | Form database port default value                              | `5432`                                                       |
| `DEFAULT_READ_ONLY`         | Form with default values are read-only                        | `true`                                                       |
| `DATABASE_NAME_PREFIX`      | Prefix name for the deployed PostgREST in k8s                 | `self-service-api`                                           |
| `K8S_NAMESPACE`             | Kubernetes namespace where PostgREST is deployed              | `default`                                                    |
| `HELP_URL`                  | Optional link to additional documentation or help resources   | `https://docs.example.com`                                   |
| `DEPLOY_MODE`               | Deployment mode: `nodePort` or `ingress`                      | `ingress`                                                    |
| `NODEPORT_EXTERNAL_ADDRESS` | Optional override for external IP/hostname in NodePort mode   | `123.45.67.89`                                               |
| `INGRESS_DOMAIN`            | Base domain used for ingress-based deployments                | `example.com`                                                |
| `INGRESS_SUBDOMAIN_PREFIX`  | Optional prefix for ingress hostnames (normalized internally) | `self-service-api`                                           |
| `DEPLOY_PROTOCOL`           | Protocol used for generated URLs: `http` or `https`           | `https`                                                      |

### Hostname construction (Ingress mode)

The final hostname becomes:

```
<INGRESS_SUBDOMAIN_PREFIX>-<databaseName>.<INGRESS_DOMAIN>
```

Example:

```
self-service-api-orders.example.com
```

> A trailing `-` is automatically removed from `INGRESS_SUBDOMAIN_PREFIX`  
> (e.g., `my-prefix-` becomes `my-prefix`).
