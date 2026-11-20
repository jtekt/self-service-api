"use server";

import { auth } from "@/auth";
import { Env } from "@/config";
import { deleteApi, getApi, isOwner, updateOwners } from "@/lib/k8s";

export interface DeleteApiState {
  error: string | null;
  data: { name: string } | null;
}

export interface UpdateOwnersState {
  error: string | null;
  data: { owners: string[] } | null;
}

export async function updateOwnersAction(
  _: UpdateOwnersState | null,
  { name, owners }: { name: string; owners: string[] },
): Promise<UpdateOwnersState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { error: "Unauthorized", data: null };

  const normalized = owners.map((o) => o.trim().toLowerCase()).filter(Boolean);

  if (!normalized.includes(email.toLowerCase()))
    return { error: "You cannot remove yourself as an owner.", data: null };

  if (normalized.length === 0)
    return { error: "At least one owner is required.", data: null };

  try {
    const api = await getApi(Env.K8S_NAMESPACE, name);
    if (!api || !isOwner(api, email))
      return { error: `API "${name}" not found`, data: null };

    // Deduplicate while preserving order
    const unique = [...new Set(normalized)];
    await updateOwners(Env.K8S_NAMESPACE, name, unique);
    return { error: null, data: { owners: unique } };
  } catch (error: unknown) {
    console.error("Error updating owners:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return { error: message, data: null };
  }
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
    if (!api || !isOwner(api, email))
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
