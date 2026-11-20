"use client";

import {
  FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { updateOwnersAction } from "@/actions/apis";
import { cn } from "@/lib/utils";

export function OwnersEditor({
  apiName,
  initialOwners,
  currentUserEmail,
}: {
  apiName: string;
  initialOwners: string[];
  currentUserEmail: string;
}) {
  const [owners, setOwners] = useState(initialOwners);
  const [input, setInput] = useState("");
  const savedOwners = useRef(initialOwners);

  const [state, action, pending] = useActionState(updateOwnersAction, null);

  useEffect(() => {
    if (!state) return;
    if (state.error) {
      toast.error(state.error);
    } else if (state.data) {
      toast.success("Owners updated.");
      savedOwners.current = state.data.owners;
      setOwners(state.data.owners);
    }
  }, [state]);

  function addOwner(e: FormEvent) {
    e.preventDefault();
    const email = input.trim().toLowerCase();
    if (!email || owners.includes(email)) return;
    setOwners([...owners, email]);
    setInput("");
  }

  function removeOwner(email: string) {
    if (email === currentUserEmail.toLowerCase()) return;
    setOwners(owners.filter((o) => o !== email));
  }

  function save() {
    startTransition(() => action({ name: apiName, owners }));
  }

  const dirty = JSON.stringify(owners) !== JSON.stringify(savedOwners.current);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {owners.map((email) => {
          const isCurrentUser = email === currentUserEmail.toLowerCase();
          return (
            <div
              key={email}
              className={cn(
                "flex items-center gap-1.5 rounded-md bg-primary/40 px-3 py-1.5 text-sm",
                isCurrentUser && "shadow",
              )}
            >
              <span>{email}</span>
              {!isCurrentUser && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => removeOwner(email)}
                  size="icon-xs"
                  aria-label={`Remove ${email}`}
                >
                  <XIcon />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={addOwner} className="flex gap-2">
        <Input
          type="email"
          placeholder="Add owner by email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={!input.trim() || pending}
        >
          Add
        </Button>
      </form>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Saving…
            </span>
          ) : (
            "Save owners"
          )}
        </Button>
      </div>
    </div>
  );
}
