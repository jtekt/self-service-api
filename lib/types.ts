export interface Column {
  name: string;
  type: string;
  isNullable: boolean;
}

export interface Table {
  name: string;
  columns: Column[];
}

export interface SchemaData {
  tables: Table[];
}

export interface DeploymentResult {
  apiUrl: string;
  namespace: string;
  deploymentName: string;
}
