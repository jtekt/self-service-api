import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import Link from "next/link";

export function HelpLink() {
  const helpUri = process.env.NEXT_PUBLIC_HELP_URL;

  if (!helpUri) return null;

  return (
    <Button variant="ghost" size="icon" className="size-8">
      <Link href={helpUri}>
        <HelpCircle />
      </Link>
    </Button>
  );
}
