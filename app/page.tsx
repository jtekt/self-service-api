import PostgRESTCreate from "@/components/postgrest-create-form";
import { Env } from "@/config";

export default function HomePage() {
  const isKeycloak = Boolean(Env.PGRST_JWT_CERT_URL && Env.PGRST_JWT_CLAIM_KEY);

  return <PostgRESTCreate isKeycloak={isKeycloak} />;
}
