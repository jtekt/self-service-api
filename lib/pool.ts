import { Pool } from "pg";

declare global {
  var __pgPools: Record<string, Pool> | undefined;
}

function getPool(uri: string): Pool {
  if (!global.__pgPools) global.__pgPools = {};

  if (!global.__pgPools[uri]) {
    global.__pgPools[uri] = new Pool({
      connectionString: uri,
      idleTimeoutMillis: 30000
    });
  }

  return global.__pgPools[uri];
}

export { getPool };