"use server";

import { getSchemas, introspectSchema } from "@/lib/database";
import type { Table } from "@/lib/types";
import { AccessControl, PostgresUriSchema } from "@/lib/validation";

type SchemaResult =
  | { success: true; schemas: string[] }
  | { success: false; error: string };

/**
 * Action: fetch available schemas from DB
 */
export async function fetchSchemas(uri: string): Promise<SchemaResult> {
  try {
    const parsed = PostgresUriSchema.safeParse(uri);

    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.message,
      };

    const schemas = await getSchemas(parsed.data);
    return { success: true, schemas };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: "Error fetching schemas" };
  }
}

type SchemaDetailsResult =
  | { success: true; tables: Table[]; accessControl: AccessControl }
  | { success: false; error: string };

/**
 * Action: introspect a schema for tables and columns
 */
export async function fetchSchemaDetails(
  uri: string,
  schema: string
): Promise<SchemaDetailsResult> {
  try {
    const parsed = PostgresUriSchema.safeParse(uri);

    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.message,
      };

    const res = await introspectSchema(parsed.data, schema);
    return { success: true, ...res };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: "Error getting schema details" };
  }
}
