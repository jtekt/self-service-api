import PostgRESTCreate from "@/components/postgrest-create";
import { Env } from "@/config";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const hasCertUrl = !!Env.PGRST_JWT_CERT_URL;
  const claimKey = Env.PGRST_JWT_CLAIM_KEY;
  const defaultHost = Env.DEFAULT_HOST;
  const defaultPort = Env.DEFAULT_PORT;

  return (
    <PostgRESTCreate
      hasCertUrl={hasCertUrl}
      claimKey={claimKey}
      defaultHost={defaultHost}
      defaultPort={defaultPort}
    />
  );
}
