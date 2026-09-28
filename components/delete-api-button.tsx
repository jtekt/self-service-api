"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { deleteApiAction } from "@/actions/apis";

export function DeleteApiButton({ name }: { name: string }) {
  const [state, action, pending] = useActionState(deleteApiAction, null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function onConfirm() {
    startTransition(() => action(name));
  }

  useEffect(() => {
    if (state?.data) {
      toast.success(`API "${name}" was deleted.`);
      router.push("/apis");
      router.refresh();
    }
  }, [state, router, name]);

  return (
    <Dialog open={open && !state?.data} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2Icon />
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent className="space-y-2">
        <DialogHeader>
          <DialogTitle>Delete API</DialogTitle>
          <DialogDescription>
            You are about to permanently delete the following API
          </DialogDescription>
        </DialogHeader>

        <div className="rounded bg-accent p-2 font-mono">{name}</div>

        <p className="text-destructive">
          Its URL will stop working. Your database and its data are not
          affected. This action cannot be undone.
        </p>

        {state?.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>

          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Deleting…
              </span>
            ) : (
              "Delete API"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
