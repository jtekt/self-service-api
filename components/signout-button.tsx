import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { LogOutIcon } from "lucide-react";

export function SignOut() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <Button type="submit"  variant="outline" size="icon">
        <LogOutIcon />
      </Button>
    </form>
  );
}
