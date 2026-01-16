import { Pool } from "pg";

declare global {
  var pgPools: Record<string, Pool> | undefined;
}

function getPool(uri: string): Pool {
  if (!global.pgPools) global.pgPools = {};

  if (!global.pgPools[uri]) {
    global.pgPools[uri] = new Pool({
      connectionString: uri,
      ssl: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });
  }

  return global.pgPools[uri];
}

export { getPool };