import { Pool } from "pg";
import type { Table } from "./types";
import type { AccessControl } from "./validation";
import { Env } from "@/config";
import type { DeploymentParams } from "@/app/api/deploy/stream/route";
import { getPool } from "./pool";

/**
 * Get schemas in the database (excluding system schemas)
 */
export async function getSchemas(uri: string) {
  const pool = getPool(uri);

  const res = await pool.query(`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog','information_schema')
    ORDER BY schema_name
  `);

  return res.rows.map((row) => row.schema_name) as string[];
}

/**
 * Introspect schema tables and columns
 */
export async function introspectSchema(
  uri: string,
  schema: string,
): Promise<{ tables: Table[]; accessControl: AccessControl }> {
  const pool = getPool(uri);

  // -----------------------
  // 1. Get tables and columns
  // -----------------------
  const tablesResult = await pool.query(
    `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = $1 
       AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    [schema],
  );

  const tables: Table[] = [];

  for (const row of tablesResult.rows) {
    const tableName = row.table_name;
    const columnsResult = await pool.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
      [schema, tableName],
    );
    tables.push({
      name: tableName,
      columns: columnsResult.rows.map((c) => ({
        name: c.column_name,
        type: c.data_type,
        isNullable: c.is_nullable === "YES",
      })),
    });
  }

  // -----------------------
  // 2. Determine access control
  // -----------------------
  // Default to public
  let accessControl: AccessControl = { type: "public", users: [] };

  // Check if the function exists
  const funcResult = await pool.query(
    `SELECT prosrc
       FROM pg_proc
       JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
       WHERE n.nspname = $1 AND proname = 'check_user'`,
    [schema],
  );

  if (funcResult.rows.length > 0) {
    const funcBody: string = funcResult.rows[0].prosrc;

    // If function exists, check if it contains user list
    const userListMatch = funcBody.match(/username NOT IN \(([^)]+)\)/);

    if (userListMatch) {
      // Extract users from the function body
      const users = userListMatch[1]
        .split(",")
        .map((u) => u.trim().replace(/^'|'$/g, "")); // remove quotes

      accessControl = { type: "specific", users };
    } else {
      // Function exists but no user list → authenticated
      accessControl = { type: "authenticated", users: [] };
    }
  } else {
    // Function does not exist → public
    accessControl = { type: "public", users: [] };
  }

  return { tables, accessControl };
}

/**
 * Generates and executes SQL to configure authentication in PostgREST.
 *
 * type:
 *  - public         → unrestricted access (remove check_user)
 *  - authenticated  → any valid OIDC user allowed
 *  - specific       → only listed users allowed
 */
export async function generateAuthFunction(params: DeploymentParams) {
  if (
    params.accessControl.type === "specific" &&
    params.accessControl.users.length === 0
  ) {
    throw new Error("Allowed Users cannot be empty");
  }

  const pool = getPool(params.dbUri);

  //
  // PUBLIC MODE → remove the function entirely
  //
  if (params.accessControl.type === "public") {
    const dropSql = `
        DROP FUNCTION IF EXISTS ${params.schema}.check_user();
      `;
    await pool.query(dropSql);
    return;
  }

  if (!Env.PGRST_JWT_CERT_URL) {
    throw new Error("Cannot authenticate without certificate URL");
  }

  //
  // Build user restriction SQL if needed
  //
  let userCheckSQL = "";

  if (params.accessControl.type === "specific") {
    if (!Env.PGRST_JWT_CLAIM_KEY) {
      throw new Error(
        "Cannot authenticate specific users without the claim key",
      );
    }

    const safeUsers = params.accessControl.users
      .map((u) => `'${u.replace(/'/g, "''")}'`)
      .join(", ");

    userCheckSQL = `
  -- "specific" mode
  IF username NOT IN (${safeUsers}) THEN
    RAISE EXCEPTION 'User % is not allowed', username;
  END IF;
      `;
  }

  //
  // Shared function SQL for authenticated + specific
  //
  const sql = `
CREATE SCHEMA IF NOT EXISTS ${params.schema};

CREATE OR REPLACE FUNCTION ${params.schema}.check_user() RETURNS void AS $$
DECLARE
  claims json;
  username text;
  path text;
BEGIN
  -- GET THE REQUEST PATH
  path := current_setting('request.path', true);

  -- Allow unrestricted access ONLY to "/"
  IF path IN ('/', '/rpc/docs') THEN
    RETURN;
  END IF;
  
  -- JWT claims
  claims := current_setting('request.jwt.claims', true)::json;

  IF claims IS NULL THEN
    RAISE EXCEPTION 'Missing JWT claims';
  END IF;

  username := claims->>'${Env.PGRST_JWT_CLAIM_KEY}';

  IF username IS NULL THEN
    RAISE EXCEPTION 'Missing ${Env.PGRST_JWT_CLAIM_KEY} claim in JWT';
  END IF;

  ${userCheckSQL}
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

  await pool.query(sql);
}

/**
 * Creates or replaces a PostgreSQL function that returns the ReDoc API docs page.
 *
 * Usage:
 *   GET /rpc/docs
 *   Accept: text/html
 */
export async function generateDocsFunction(params: DeploymentParams) {
  const pool = getPool(params.dbUri);

  const sql = `
DO $$
BEGIN
    -- Check if domain exists using the internal typname
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'text/html'
    ) THEN
        CREATE DOMAIN "text/html" AS TEXT;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION ${params.schema}.docs()
returns "text/html"
AS $$
  SELECT $html$
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="SwaggerUI" />
  <title>SwaggerUI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
<script>
  window.onload = async () => {
    const response = await fetch(window.location.origin);
    const spec = await response.json();

    // Fix host and scheme dynamically for OpenAPI 2
    spec.host = window.location.host; // only host:port, e.g., "172.16.98.151:30264"
    spec.schemes = [window.location.protocol.replace(":", "")]; // ["http"] or ["https"]

    window.ui = SwaggerUIBundle({
      spec: spec,
      dom_id: '#swagger-ui',
    });
  };
</script>
</body>
</html>
$html$;
$$ LANGUAGE sql;
`;

  await pool.query(sql);
}
