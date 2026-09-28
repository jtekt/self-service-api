import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Link opening in a new tab, styled like shadcn's links (underline rather
// than color) so it follows the neutral light/dark theme
export function ExternalLink({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"a">, "target" | "rel">) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "font-medium break-all underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:decoration-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ExternalLinkIcon className="ml-1 inline size-3.5 shrink-0 align-[-0.125em] text-muted-foreground" />
    </a>
  );
}
