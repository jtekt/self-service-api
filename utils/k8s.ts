export function toK8sName(input: string): string {
  return input
    .toLowerCase()
    .replace(/_/g, "-")             // replace underscores
    .replace(/[^a-z0-9-]/g, "-")    // replace all invalid chars
    .replace(/-+/g, "-")            // collapse multiple hyphens
    .replace(/^-+/, "")             // trim leading hyphens
    .replace(/-+$/, "");            // trim trailing hyphens
}