# Self-PostgREST UI

A lightweight UI to deploy **PostgREST** services on a **Kubernetes cluster**.

This application allows users to self-service the creation of a PostgREST API by:

1.  **Connecting to PostgreSQL** (providing database credentials).
2.  **Choosing a schema** from the connected database.
3.  **Setting access rules** (authentication mode).
4.  **Deploying PostgREST** into the same Kubernetes cluster where this app is running.

---

## 🔐 Access Control

Choose how your generated API should authenticate:

- **`public`** &mdash; No authentication required.
- **`authenticated`** &mdash; Requires any valid OIDC JWT.
- **`specific`** &mdash; Restricted to only selected OIDC users.

For authenticated modes, the application uses the JWT claim: **`PGRST_JWT_CLAIM_KEY`**.

> **Note:** To enable authenticated modes, the `PGRST_JWT_SECRET` environment variable must contain a **JWKS** (e.g., the public key set from an identity provider like Keycloak).
>
> **Example JWKS URI:**
>
> ```
> /realms/<realm>/protocol/openid-connect/certs
> ```

---

## 📦 Deployment Flow

The UI streamlines the setup process through these steps:

1.  User connects to the database.
2.  The app introspects available schemas.
3.  User selects the desired schema and defines access rules.
4.  The app deploys a dedicated PostgREST instance in the **same Kubernetes cluster**.
5.  A Kubernetes **NodePort** service is created for external access.
6.  User receives the final API URL, which will look like:

```
http://<CLUSTER_ACCESS_URI>:<nodePort>
```

---

## ⚙️ Environment Variables

Configure the UI application using the following environment variables:

| Variable                              | Description                                                     | Example                                                      |
| :------------------------------------ | :-------------------------------------------------------------- | :----------------------------------------------------------- |
| **`PGRST_IMAGE`**                     | PostgREST Docker image used for deployments.                    | `postgrest/postgrest`                                        |
| **`PGRST_JWT_CERT_URL`**  | URL for the certificates.                                       | `http://keycloak/realms/realm/protocol/openid-connect/certs` |
| **`PGRST_JWT_CLAIM_KEY`** | JWT key for identifying the user.                               | `email`                                                      |
| **`K8S_NAMESPACE`**                   | Kubernetes namespace where PostgREST will be deployed.          | `default`                                                    |
| **`K8S_APP_PREFIX`**                  | Prefix used when naming the PostgREST deployments and services. | `api`                                                        |
| **`CLUSTER_ACCESS_URI`**              | Base URL used to generate the final API URL (NodePort access).  | `http://111.11.11.11`                                        |
