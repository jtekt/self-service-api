import PostgRESTCreate from "@/components/postgrest-create-form";
import { PGRST_JWT_SECRET } from "@/config";

export default function HomePage() {
  const isKeycloak = Boolean(PGRST_JWT_SECRET);

  return <PostgRESTCreate isKeycloak={isKeycloak} />;
}
