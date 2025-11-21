import { Pool } from "pg";
import type { Table } from "./types";
import type { AccessControl } from "./validation";
import { Env } from "@/config";

/**
 * Get schemas in the database (excluding system schemas)
 */
export async function getSchemas(uri: string) {
  const pool = new Pool({ connectionString: uri });
  try {
    const res = await pool.query(
      `SELECT schema_name 
       FROM information_schema.schemata 
       WHERE schema_name NOT IN ('pg_catalog','information_schema')
       ORDER BY schema_name`,
    );
    return res.rows.map((row) => row.schema_name) as string[];
  } finally {
    await pool.end();
  }
}

/**
 * Introspect schema tables and columns
 */
export async function introspectSchema(
  uri: string,
  schema: string,
): Promise<{ tables: Table[]; accessControl: AccessControl }> {
  const pool = new Pool({ connectionString: uri });
  try {
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
  } finally {
    await pool.end();
  }
}

/**
 * Generates and executes SQL to configure authentication in PostgREST.
 *
 * type:
 *  - public         → unrestricted access (remove check_user)
 *  - authenticated  → any valid OIDC user allowed
 *  - specific       → only listed users allowed
 */
export async function generateAuthFunction(
  uri: string,
  accessControl: AccessControl,
  schema: string = "public",
) {
  if (accessControl.type === "specific" && accessControl.users.length === 0) {
    throw new Error("Allowed Users cannot be empty");
  }

  const pool = new Pool({ connectionString: uri });

  try {
    //
    // PUBLIC MODE → remove the function entirely
    //
    if (accessControl.type === "public") {
      const dropSql = `
        DROP FUNCTION IF EXISTS ${schema}.check_user();
      `;
      await pool.query(dropSql);
      return;
    }

    if(!Env.PGRST_JWT_CERT_URL) {
      throw new Error("Cannot authenticate without certificate URL")
    }

    //
    // Build user restriction SQL if needed
    //
    let userCheckSQL = "";

    if (accessControl.type === "specific") {
      if(!Env.PGRST_JWT_CLAIM_KEY) {
        throw new Error("Cannot authenticate specific users without the claim key")
      }

      const safeUsers = accessControl.users
        .map((u) => `'${u.replace(/'/g, "''")}'`)
        .join(", ");

      userCheckSQL = `
        IF username NOT IN (${safeUsers}) THEN
          RAISE EXCEPTION 'User % is not allowed', username;
        END IF;
      `;
    }

    //
    // Shared function SQL for authenticated + specific
    //
    const sql = `
CREATE SCHEMA IF NOT EXISTS ${schema};

CREATE OR REPLACE FUNCTION ${schema}.check_user() RETURNS void AS $$
DECLARE
  claims json;
  username text;
BEGIN
  -- JWT claims
  claims := current_setting('request.jwt.claims', true)::json;

  IF claims IS NULL THEN
    RAISE EXCEPTION 'Missing JWT claims';
  END IF;

  username := claims->>'${Env.PGRST_JWT_CLAIM_KEY}';

  IF username IS NULL THEN
    RAISE EXCEPTION 'Missing ${Env.PGRST_JWT_CLAIM_KEY} claim in JWT';
  END IF;

  -- Only "specific" mode restricts which usernames are allowed
  ${userCheckSQL}
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

    await pool.query(sql);
  } finally {
    await pool.end();
  }
}
