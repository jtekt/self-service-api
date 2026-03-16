import { auth } from "@/auth";
import PostgRESTCreate from "@/components/postgrest-create";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Env } from "@/config";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth()

  if(!session) redirect("/api/auth/signin")

  const hasCertUrl = !!Env.PGRST_JWT_CERT_URL;
  const claimKey = Env.PGRST_JWT_CLAIM_KEY;
  const defaultHost = Env.DEFAULT_HOST;
  const defaultPort = Env.DEFAULT_PORT;
  const defaultSSL = Env.DEFAULT_SSL;
  const defaultReadOnly = Env.DEFAULT_READ_ONLY;
  const message = Env.MESSAGE;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold">
          Create a REST API for your database
        </h1>
        <p className="mt-3 text-gray-600">
          Connect → Choose schema → Set access rules → Deploy
        </p>
      </div>
      {message && (
        <Alert>
          <AlertDescription>
            <p dangerouslySetInnerHTML={{ __html: message }} />
          </AlertDescription>
        </Alert>
      )}
      <PostgRESTCreate
        hasCertUrl={hasCertUrl}
        claimKey={claimKey}
        defaults={{
          host: defaultHost,
          port: defaultPort,
          ssl: defaultSSL,
        }}
        defaultReadOnly={defaultReadOnly}
      />
    </div>
  );
}
