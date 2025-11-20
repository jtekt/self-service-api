"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { CheckIcon, XIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Table } from "@/lib/types";
import { fetchSchemaDetails, fetchSchemas } from "@/actions/database";
import { AccessControl } from "@/lib/validation";
import { TablesViewer } from "./table-viewer";

type AccessType = "public" | "authenticated" | "specific";

export default function PostgRESTCreate({
  isKeycloak = false,
}: {
  isKeycloak: boolean;
}) {
  // Database connection
  const [dbUri, setDbUri] = useState("");
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null,
  );

  // Schema & tables
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>("");
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  // Access control
  const [accessType, setAccessType] = useState<AccessControl["type"]>(
    isKeycloak ? "authenticated" : "public",
  );
  const [specificUsers, setSpecificUsers] = useState<AccessControl["users"]>(
    [],
  );
  const [newUserInput, setNewUserInput] = useState("");

  // Deployment
  const [deploying, setDeploying] = useState(false);
  const [currentProgress, setCurrentProgress] = useState("");
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<{
    apiUrl?: string;
    namespace: string;
    deploymentName: string;
  } | null>(null);

  const handleTestConnection = async (e: FormEvent) => {
    e.preventDefault();
    if (!dbUri) return;

    setLoading(true);
    setTestResult(null);
    setSchemas([]);
    setSelectedSchema("");
    setTables([]);
    resetDeployment();

    try {
      const res = await fetchSchemas(dbUri);

      if (!res.success) {
        setTestResult("error");
        toast.error(res.error);
        return;
      }

      const availableSchemas = res.schemas || [];
      setSchemas(availableSchemas);

      if (availableSchemas.length === 0) {
        toast.warning("No schemas found in this database.");
      } else {
        setSelectedSchema(
          availableSchemas.length === 1 ? availableSchemas[0] : "",
        );
        toast.success("Connection successful!");
        setTestResult("success");
      }
    } catch (err: any) {
      setTestResult("error");
      toast.error(err.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const resetDeployment = () => {
    setDeploying(false);
    setCurrentProgress("");
    setDeployError(null);
    setDeployResult(null);
  };

  const handleDeploy = async () => {
    if (!dbUri || !selectedSchema || tables.length === 0) {
      toast.error("Please connect to a database and select a schema first.");
      return;
    }

    setDeploying(true);
    setCurrentProgress("Starting deployment...");
    setDeployError(null);
    setDeployResult(null);

    const payload = {
      uri: dbUri,
      schema: selectedSchema,
      tables,
      accessControl: {
        type: accessType,
        users: accessType === "specific" ? specificUsers : [],
      },
    };

    const response = await fetch("/api/deploy/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      setDeployError("Failed to start deployment stream");
      setDeploying(false);
      return;
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let json;
        try {
          json = JSON.parse(line);
        } catch {
          continue;
        }

        if (json.type === "progress") {
          setCurrentProgress(json.message || "Working...");
        } else if (json.type === "error") {
          setDeployError(json.message || "Deployment failed");
          setDeploying(false);
          return;
        } else if (json.type === "complete") {
          setDeployResult(json);
          setCurrentProgress("Deployment completed successfully!");
          setDeploying(false);
          return;
        }
      }
    }
  };

  const addSpecificUser = (e: FormEvent) => {
    e.preventDefault();

    const trimmed = newUserInput.trim();
    if (trimmed && !specificUsers.includes(trimmed)) {
      setSpecificUsers([...specificUsers, trimmed]);
      setNewUserInput("");
    }
  };

  const removeSpecificUser = (user: string) => {
    setSpecificUsers(specificUsers.filter((u) => u !== user));
  };

  useEffect(() => {
    if (!dbUri || !selectedSchema) return;

    setTablesLoading(true);
    setTables([]);
    resetDeployment();

    (async () => {
      try {
        const res = await fetchSchemaDetails(dbUri, selectedSchema);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        setTables(res.tables);
        setAccessType(isKeycloak ? res.accessControl.type : "public");
        setSpecificUsers(res.accessControl.users);
      } catch (err: any) {
        toast.error(err.message || "Failed to fetch tables");
      } finally {
        setTablesLoading(false);
      }
    })();
  }, [dbUri, selectedSchema]);

  useEffect(() => {
    resetDeployment();
  }, [accessType]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">
          Create a REST API for your database
        </h1>
        <p className="mt-3 text-gray-600">
          Connect to PostgreSQL → Choose schema → Set access rules → Deploy
        </p>
      </div>

      <form onSubmit={handleTestConnection} className="space-y-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="uri">PostgreSQL Connection URI</FieldLabel>
            <div className="flex gap-3">
              <Input
                id="uri"
                placeholder="postgresql://user:password@host:5432/dbname"
                value={dbUri}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setDbUri(e.target.value)
                }
                disabled={loading || deploying}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={!dbUri || loading || deploying}
                variant={testResult === "success" ? "outline" : "default"}
              >
                {loading ? (
                  <Spinner />
                ) : testResult === "success" ? (
                  <CheckIcon className="h-5 w-5 text-green-600" />
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>
          </Field>
        </FieldGroup>
      </form>

      {testResult === "success" && (
        <>
          {schemas.length === 1 ? (
            <div className="space-y-2">
              <FieldLabel>Schema</FieldLabel>
              <div className="rounded-lg bg-muted p-3 font-medium">
                {schemas[0]}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <FieldLabel>Select Schema</FieldLabel>
              <Select
                value={selectedSchema}
                onValueChange={setSelectedSchema}
                disabled={deploying}
              >
                <SelectTrigger className="min-w-44">
                  <SelectValue placeholder="Choose a schema" />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(tablesLoading || (selectedSchema && tables.length > 0)) && (
            <TablesViewer tables={tables} tablesLoading={tablesLoading} />
          )}

          {selectedSchema && tables.length > 0 && (
            <div className="space-y-5 rounded-lg border bg-muted/30 p-5">
              <div className="space-y-2">
                <FieldLabel>API Access Control</FieldLabel>
                <Select
                  value={accessType}
                  onValueChange={(v) => setAccessType(v as AccessType)}
                  disabled={deploying}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      Public – Anyone can use the API
                    </SelectItem>
                    {isKeycloak && (
                      <>
                        <SelectItem value="authenticated">
                          Authenticated – Any logged-in Keycloak user
                        </SelectItem>
                        <SelectItem value="specific">
                          Specific users only
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {accessType === "specific" && (
                <div className="space-y-3">
                  <form onSubmit={addSpecificUser} className="flex gap-2">
                    <Input
                      placeholder="Employee number (00 + employee number)"
                      value={newUserInput}
                      onChange={(e) => setNewUserInput(e.target.value)}
                      disabled={deploying}
                    />
                    <Button
                      type="submit"
                      disabled={!newUserInput.trim() || deploying}
                    >
                      Add
                    </Button>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    {specificUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No users added yet
                      </p>
                    ) : (
                      specificUsers.map((user) => (
                        <div
                          key={user}
                          className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5"
                        >
                          <span className="text-sm">{user}</span>
                          <button
                            type="button"
                            onClick={() => removeSpecificUser(user)}
                            className="rounded-full p-0.5 hover:bg-primary/20"
                            disabled={deploying}
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {selectedSchema && tables.length > 0 && (
            <>
              {!deploying && !deployError && !deployResult ? null : (
                <div className="space-y-5 rounded-lg border bg-muted/30 p-6">
                  <h2 className="text-2xl font-semibold">
                    {deploying
                      ? "Deploying your API..."
                      : deployError
                        ? "Deployment Failed"
                        : "Deployment Successful!"}
                  </h2>

                  {deploying && (
                    <div className="flex items-center gap-4 text-lg">
                      <Spinner className="h-6 w-6" />
                      <span>{currentProgress || "Initializing..."}</span>
                    </div>
                  )}

                  {deployError && (
                    <Alert variant="destructive">
                      <AlertTitle>{deployError}</AlertTitle>
                    </Alert>
                  )}

                  {deployResult && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
                        <p className="mb-2 text-lg font-medium">
                          Your API is live!
                        </p>
                        <p>
                          <span className="font-medium">URL:</span>{" "}
                          <a
                            href={deployResult.apiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-blue-600 underline dark:text-blue-400"
                          >
                            {deployResult.apiUrl}
                          </a>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-center">
                <Button
                  size="lg"
                  className="gap-3"
                  disabled={loading || deploying || tablesLoading}
                  onClick={handleDeploy}
                >
                  {deploying ? <Spinner /> : null}
                  {deploying ? "Deploying..." : "Deploy REST API"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
