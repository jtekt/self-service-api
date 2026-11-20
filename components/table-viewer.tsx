import { Table } from "@/lib/types";
import { Skeleton } from "./ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

export function TablesViewer({
  tables,
  tablesLoading,
}: {
  tables: Table[];
  tablesLoading: boolean;
}) {
  if (tablesLoading) {
    return (
      <div className="space-y-3 rounded-lg border p-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="divide-y rounded-lg border">
      {tables.map((table) => (
        <AccordionItem value={table.name} key={table.name}>
          <AccordionTrigger className="cursor-pointer rounded p-4 transition hover:bg-muted/50">
            <span className="flex items-center gap-2">
              <span className="text-lg font-semibold">{table.name}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  table.type === "view"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                }`}
              >
                {table.type}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="my-3 ml-6 space-y-1.5 text-sm text-muted-foreground">
            {table.columns.map((col) => (
              <div key={col.name} className="flex items-center gap-2">
                <span className="font-medium text-foreground">{col.name}</span>
                <span className="text-primary">({col.type})</span>
                {col.isNullable && <span className="text-xs">Nullable</span>}
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
