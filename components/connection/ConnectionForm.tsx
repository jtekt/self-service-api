"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { connectionSchema, ConnectionSchema } from "@/lib/validation";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { RefreshCwIcon } from "lucide-react";

type Props = {
  defaultValues?: Partial<ConnectionSchema>;
  readOnly: {
    host: boolean;
    port: boolean;
    user: boolean;
    password: boolean;
    database: boolean;
    ssl: boolean;
  };
  onTest: (values: ConnectionSchema) => Promise<void>;
  disabled?: boolean;
  hidden?: boolean;
  onEdit: () => void;
  onRefresh: () => void;
  testSuccess?: boolean;
  loading?: boolean;
};

export function ConnectionForm({
  defaultValues,
  readOnly,
  onTest,
  disabled,
  hidden,
  onEdit,
  onRefresh,
  testSuccess,
  loading,
}: Props) {
  const form = useForm<ConnectionSchema>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      host: "",
      port: "5432",
      user: "",
      password: "",
      database: "",
      ssl: true,
      ...defaultValues,
    },
    mode: "onBlur",
  });

  const { handleSubmit, formState } = form;
  const { isSubmitting } = formState;

  if (hidden && testSuccess) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-100">
        <p className="mr-auto font-semibold">Connection successful!</p>
        <Button variant="outline" onClick={onEdit} disabled={loading}>
          Edit Connection
        </Button>
        <Button variant="outline" onClick={onRefresh} disabled={loading}>
          <RefreshCwIcon className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
    );
  }

  return (
    <Card className="p-4 md:p-4">
      <form
        onSubmit={handleSubmit(onTest)}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <Controller
          name="host"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Host</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                aria-invalid={fieldState.invalid}
                readOnly={readOnly.host}
                className={
                  readOnly.host
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : ""
                }
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="port"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Port</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                aria-invalid={fieldState.invalid}
                readOnly={readOnly.port}
                className={
                  readOnly.port
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : ""
                }
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="user"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>User</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                aria-invalid={fieldState.invalid}
                readOnly={readOnly.user}
                className={
                  readOnly.user
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : ""
                }
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                aria-invalid={fieldState.invalid}
                readOnly={readOnly.password}
                className={
                  readOnly.password
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : ""
                }
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="database"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="md:col-span-2">
              <FieldLabel htmlFor={field.name}>Database</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                aria-invalid={fieldState.invalid}
                readOnly={readOnly.database}
                className={
                  readOnly.database
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : ""
                }
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="ssl"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="ssl"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={readOnly.ssl}
                aria-readonly={readOnly.ssl}
                className={
                  readOnly.ssl
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : ""
                }
              />
              <FieldLabel htmlFor="ssl" className="font-normal">
                Use SSL
              </FieldLabel>
            </Field>
          )}
        />

        {/* Submit button — full width on mobile */}
        <Button
          type="submit"
          disabled={disabled || isSubmitting}
          className="md:col-span-2"
        >
          {isSubmitting ? <Spinner /> : "Test Connection"}
        </Button>
      </form>
    </Card>
  );
}
