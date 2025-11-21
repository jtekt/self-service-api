import { Button } from "@/components/ui/button";
import { Env } from "@/config";
import { HelpCircle } from "lucide-react";
import Link from "next/link";

export function HelpLink() {
  const helpUri = Env.HELP_URL;

  if (!helpUri) return null;

  return (
    <Link href={helpUri}>
      <Button variant="outline" size="icon">
        <HelpCircle />
      </Button>
    </Link>
  );
}
