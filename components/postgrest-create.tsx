"use client";

import { FormEvent, useEffect, useState } from "react";
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
import { FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { Table } from "@/lib/types";
import { fetchSchemaDetails, fetchSchemas } from "@/actions/database";
import { TablesViewer } from "./table-viewer";
import type { AccessControl, ConnectionSchema } from "@/lib/validation";

import { ConnectionForm } from "@/components/connection/ConnectionForm";

type AccessType = "public" | "authenticated" | "specific";

type Props = {
  hasCertUrl: boolean;
  claimKey: string | undefined;
  defaultHost?: string;
  defaultPort?: string;
  defaultReadOnly: boolean;
};

export default function PostgRESTCreate({
  hasCertUrl,
  claimKey,
  defaultPort,
  defaultHost,
  defaultReadOnly,
}: Props) {
  // connection data
  const [connectionValues, setConnectionValues] =
    useState<ConnectionSchema | null>({
      database: "",
      host: defaultHost ?? "",
      password: "",
      port: defaultPort ?? "5432",
      ssl: false,
      user: "",
    });

  const [connectionFormHidden, setConnectionFormHidden] = useState(false);

  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: "success" | "error";
    message?: string;
  } | null>(null);

  // schema & tables
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>("");
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  // access control
  const [accessType, setAccessType] = useState<AccessControl["type"]>(
    process.env.PGRST_JWT_CERT_URL ? "authenticated" : "public",
  );
  const [specificUsers, setSpecificUsers] = useState<AccessControl["users"]>(
    [],
  );

  const [newUserInput, setNewUserInput] = useState("");

  // deployment
  const [deploying, setDeploying] = useState(false);
  const [currentProgress, setCurrentProgress] = useState("");
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<{
    apiUrl?: string;
    namespace: string;
    deploymentName: string;
  } | null>(null);

  const readOnly = {
    host: defaultReadOnly && defaultHost !== undefined,
    port: defaultReadOnly && defaultPort !== undefined,
    user: false,
    password: false,
    database: false,
    ssl: false,
  };

  // -------------------------------------------------------------------
  // UTIL: Compose final URI
  // -------------------------------------------------------------------
  const buildUri = (c: ConnectionSchema) => {
    return `postgresql://${c.user}:${c.password}@${c.host}:${c.port}/${c.database}?sslmode=${
      c.ssl ? "require" : "disable"
    }`;
  };

  // -------------------------------------------------------------------
  // TEST CONNECTION
  // -------------------------------------------------------------------
  const handleTestConnectionWithUri = async (uri: string) => {
    setLoading(true);
    setTestResult(null);
    setSchemas([]);
    setSelectedSchema("");
    setTables([]);
    resetDeployment();

    try {
      const res = await fetchSchemas(uri);

      if (!res.success) {
        setTestResult({
          status: "error",
          message: res.error,
        });
        toast.error(res.error);
        return;
      }

      setSchemas(res.schemas || []);
      if(res.schemas.length === 1) {
        setSelectedSchema(res.schemas[0])
      }
      setTestResult({ status: "success" });
      toast.success("Connection successful!");
      setConnectionFormHidden(true);
    } catch (err: any) {
      const message = err.message || "Connection failed";
      setTestResult({ status: "error", message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------
  const resetDeployment = () => {
    setDeploying(false);
    setCurrentProgress("");
    setDeployError(null);
    setDeployResult(null);
  };

  // -------------------------------------------------------------------
  // SCHEMA TABLE FETCHING
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!connectionValues || !selectedSchema) return;

    const uri = buildUri(connectionValues);
    setTablesLoading(true);
    setTables([]);
    resetDeployment();

    (async () => {
      try {
        const res = await fetchSchemaDetails(uri, selectedSchema);
        if (!res.success) {
          toast.error(res.error);
          return;
        }

        setTables(res.tables);
        setAccessType(res.accessControl.type);
        setSpecificUsers(res.accessControl.users);
      } catch (err: any) {
        toast.error(err.message || "Failed to fetch tables");
      } finally {
        setTablesLoading(false);
      }
    })();
  }, [selectedSchema, connectionValues]);

  // -------------------------------------------------------------------
  // DEPLOY
  // -------------------------------------------------------------------
  const handleDeploy = async () => {
    if (!connectionValues || !selectedSchema || tables.length === 0) {
      toast.error("Please connect to a database and select a schema first.");
      return;
    }

    const uri = buildUri(connectionValues);

    setDeploying(true);
    setCurrentProgress("Starting deployment...");
    setDeployError(null);
    setDeployResult(null);

    const payload = {
      uri,
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

  // -------------------------------------------------------------------
  // UI HELPERS
  // -------------------------------------------------------------------
  const addSpecificUser = (e: FormEvent) => {
    e.preventDefault();
    if (!claimKey) return;

    const trimmed = newUserInput.trim();
    if (trimmed && !specificUsers.includes(trimmed)) {
      setSpecificUsers([...specificUsers, trimmed]);
      setNewUserInput("");
    }
  };

  const removeSpecificUser = (u: string) => {
    setSpecificUsers(specificUsers.filter((x) => x !== u));
  };

  // -------------------------------------------------------------------
  // RENDER COMPONENT
  // -------------------------------------------------------------------
  const renderSchema = () => {
    return schemas.length === 1 ? (
      <div className="space-y-2">
        <FieldLabel>Schema</FieldLabel>
        <div className="rounded-lg bg-muted p-3 font-medium">{schemas[0]}</div>
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
    );
  };

  const renderTables = () => {
    if (!selectedSchema) return;
    if (tablesLoading) return <TablesViewer tables={[]} tablesLoading />;

    if (tables.length === 0) {
      return (
        <Alert variant="warning">
          <AlertTitle>No tables found.</AlertTitle>
        </Alert>
      );
    }

    return (
      <>
        <TablesViewer tables={tables} tablesLoading={false} />

        {/* ACCESS CONTROL */}
        <div className="space-y-5 rounded-lg border bg-muted/30 p-5">
          <FieldLabel>API Access Control</FieldLabel>
          <Select
            value={accessType}
            onValueChange={(v) => setAccessType(v as AccessType)}
            disabled={deploying}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose access type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>

              {hasCertUrl && (
                <SelectItem value="authenticated">Authenticated</SelectItem>
              )}

              {hasCertUrl && claimKey && (
                <SelectItem value="specific">Specific users</SelectItem>
              )}
            </SelectContent>
          </Select>

          {accessType === "specific" && hasCertUrl && claimKey && (
            <div className="space-y-3">
              <form onSubmit={addSpecificUser} className="flex gap-2">
                <Input
                  placeholder={`User identifier (${claimKey})`}
                  value={newUserInput}
                  onChange={(e) => setNewUserInput(e.target.value)}
                  disabled={deploying}
                />
                <Button disabled={!newUserInput.trim() || deploying}>
                  Add
                </Button>
              </form>

              {specificUsers.length === 0 ? (
                <Alert variant="warning">
                  <AlertTitle>No users added yet.</AlertTitle>
                </Alert>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {specificUsers.map((u) => (
                    <div
                      key={u}
                      className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5"
                    >
                      <span className="text-sm">{u}</span>
                      <button
                        type="button"
                        onClick={() => removeSpecificUser(u)}
                        className="rounded-full p-0.5 hover:bg-primary/20"
                        disabled={deploying}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* DEPLOY */}
        <div className="flex justify-center">
          <Button
            size="lg"
            className="gap-3"
            disabled={loading || deploying || tablesLoading}
            onClick={handleDeploy}
          >
            {deploying && <Spinner />}
            {deploying ? "Deploying..." : "Deploy REST API"}
          </Button>
        </div>

        {deploying || deployError || deployResult ? (
          <div className="space-y-5 rounded-lg border bg-muted/30 p-6">
            <h2 className="text-2xl font-semibold">
              {deploying
                ? "Deploying..."
                : deployError
                  ? "Deployment Failed"
                  : "Deployment Successful"}
            </h2>

            {deploying && (
              <div className="flex items-center gap-4 text-lg">
                <Spinner className="h-6 w-6" />
                <span>{currentProgress}</span>
              </div>
            )}

            {deployError && (
              <Alert variant="destructive">
                <AlertTitle>{deployError}</AlertTitle>
              </Alert>
            )}

            {deployResult && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-2">
                  <div className="text-right font-medium">Base URL:</div>
                  <a
                    href={deployResult.apiUrl}
                    className="break-all text-blue-600 underline"
                    target="_blank"
                  >
                    {deployResult.apiUrl}
                  </a>

                  <div className="text-right font-medium">Documentation:</div>
                  <a
                    href={`${deployResult.apiUrl}/rpc/docs`}
                    className="break-all text-blue-600 underline"
                    target="_blank"
                  >
                    {deployResult.apiUrl}/rpc/docs
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </>
    );
  };

  // -------------------------------------------------------------------
  return (
    <>
      {/* CONNECTION FORM */}
      <ConnectionForm
        defaultValues={connectionValues ?? undefined}
        readOnly={readOnly}
        hidden={connectionFormHidden}
        testSuccess={testResult?.status === "success"}
        disabled={loading || deploying}
        onEdit={() => {
          setConnectionFormHidden(false);
          setTestResult(null);
        }}
        onTest={async (values) => {
          setConnectionValues(values);
          const uri = buildUri(values);
          await handleTestConnectionWithUri(uri);
        }}
      />

      {/* RESULT SECTIONS */}
      {testResult?.status === "success" && (
        <>
          {renderSchema()}
          {renderTables()}
        </>
      )}

      {testResult?.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Connection Failed</AlertTitle>
          <AlertDescription>{testResult.message}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
