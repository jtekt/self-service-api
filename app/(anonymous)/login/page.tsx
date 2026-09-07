import { LogInIcon } from "lucide-react";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={async () => {
            "use server";
            await signIn("oidc", { redirectTo: "/" });
          }}
        >
          <Button type="submit" className="w-full">
            <LogInIcon />
            Continue with SSO
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
