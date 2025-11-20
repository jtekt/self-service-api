import PostgRESTCreate from "@/components/postgrest-create-form";
import { isAuth } from "@/config";

export default function HomePage() {
  return <PostgRESTCreate isKeycloak={isAuth} />;
}
