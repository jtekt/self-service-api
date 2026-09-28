import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Env } from "@/config";
import { BackToApisLink } from "@/components/back-to-apis-link";
import { DeleteApiButton } from "@/components/delete-api-button";
import { getApi, getApiUrl, isUser } from "@/lib/k8s";

export const dynamic = "force-dynamic";

export default async function ApiPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const { name } = await params;
  const api = await getApi(Env.K8S_NAMESPACE, name);

  if (!api || !isUser(api, email) || api.metadata?.deletionTimestamp) {
    notFound();
  }

  const url = getApiUrl(name);
  const ready =
    !!api.status?.replicas && api.status.readyReplicas === api.status.replicas;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <BackToApisLink />

      <h1 className="truncate text-2xl font-bold">{name}</h1>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="font-medium">Status</dt>
        <dd>{ready ? "Running" : "Not ready"}</dd>

        {url && (
          <>
            <dt className="font-medium">Base URL</dt>
            <dd>
              <a
                href={url}
                target="_blank"
                className="break-all text-blue-600 underline"
              >
                {url}
              </a>
            </dd>

            <dt className="font-medium">Documentation</dt>
            <dd>
              <a
                href={`${url}/rpc/docs`}
                target="_blank"
                className="break-all text-blue-600 underline"
              >
                {url}/rpc/docs
              </a>
            </dd>
          </>
        )}

        {api.metadata?.creationTimestamp && (
          <>
            <dt className="font-medium">Created</dt>
            <dd>{new Date(api.metadata.creationTimestamp).toLocaleString()}</dd>
          </>
        )}
      </dl>

      <div className="flex justify-end">
        <DeleteApiButton name={name} />
      </div>
    </div>
  );
}
