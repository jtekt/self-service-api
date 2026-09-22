import { Button } from "@/components/ui/button";
import { Env } from "@/config";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";

export function AppsLink() {
  const appsUri = Env.APPS_URL;

  if (!appsUri) return null;

  return (
    <Link href={appsUri}>
      <Button variant="outline" size="icon">
        <LayoutGrid />
      </Button>
    </Link>
  );
}
