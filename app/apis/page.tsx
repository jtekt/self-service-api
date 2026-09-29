import Link from "next/link";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Env } from "@/config";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { listApisForUser } from "@/lib/k8s";

export const dynamic = "force-dynamic";

export default async function ApisPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const apis = await listApisForUser(Env.K8S_NAMESPACE, email);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your APIs</h1>
        <Link
          href="/apis/new"
          className={buttonVariants({ size: "icon" })}
          aria-label="New API"
          title="New API"
        >
          <PlusIcon className="size-4" />
        </Link>
      </div>

      {apis.length === 0 ? (
        <p className="text-muted-foreground">
          You haven&apos;t deployed any APIs yet.
        </p>
      ) : (
        <div className="space-y-3">
          {apis.map((api) => (
            <Link
              key={api.metadata!.name}
              href={`/apis/${api.metadata!.name}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{api.metadata!.name}</p>
                    {api.metadata?.creationTimestamp && (
                      <p className="text-sm text-muted-foreground">
                        Created{" "}
                        {new Date(
                          api.metadata.creationTimestamp,
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <ChevronRightIcon className="size-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
