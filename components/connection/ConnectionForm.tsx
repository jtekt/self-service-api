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
  onEdit?: () => void;
  testSuccess?: boolean;
};

export function ConnectionForm({
  defaultValues,
  readOnly,
  onTest,
  disabled,
  hidden,
  onEdit,
  testSuccess,
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

  const { handleSubmit, register, formState } = form;
  const { isSubmitting } = formState;

  if (hidden && testSuccess) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-green-50 p-4">
        <p className="font-semibold text-green-800">Connection successful!</p>
        <Button variant="outline" onClick={onEdit}>
          Edit Connection
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
