import PostgRESTCreate from "@/components/postgrest-create";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Env } from "@/config";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const hasCertUrl = !!Env.PGRST_JWT_CERT_URL;
  const claimKey = Env.PGRST_JWT_CLAIM_KEY;
  const defaultHost = Env.DEFAULT_HOST;
  const defaultPort = Env.DEFAULT_PORT;
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
          <AlertDescription ><p dangerouslySetInnerHTML={{ __html: message }} /></AlertDescription>
        </Alert>
      )}
      <PostgRESTCreate
        hasCertUrl={hasCertUrl}
        claimKey={claimKey}
        defaultHost={defaultHost}
        defaultPort={defaultPort}
        defaultReadOnly={defaultReadOnly}
      />
    </div>
  );
}
