import PostgRESTCreate from "@/components/postgrest-create-form";
import { Env } from "@/config";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const hasCertUrl = !!Env.PGRST_JWT_CERT_URL;
  const claimKey = Env.PGRST_JWT_CLAIM_KEY;

  return <PostgRESTCreate hasCertUrl={hasCertUrl} claimKey={claimKey} />;
}
