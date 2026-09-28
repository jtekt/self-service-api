"use server";

import { auth } from "@/auth";
import { Env } from "@/config";
import { deleteApi, getApi, isUser } from "@/lib/k8s";

export interface DeleteApiState {
  error: string | null;
  data: { name: string } | null;
}

export async function deleteApiAction(
  _: DeleteApiState | null,
  name: string,
): Promise<DeleteApiState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { error: "Unauthorized", data: null };

  try {
    // Never trust the client-supplied name: re-check ownership server-side
    const api = await getApi(Env.K8S_NAMESPACE, name);
    if (!api || !isUser(api, email))
      return { error: `API "${name}" not found`, data: null };

    await deleteApi(Env.K8S_NAMESPACE, name);
    return { error: null, data: { name } };
  } catch (error: unknown) {
    console.error("Error deleting API:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return { error: message, data: null };
  }
}
