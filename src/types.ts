/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- 1. COMPILED APPLICATION SCHEMA CONTRACTS ---

export interface DBField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'relation';
  required: boolean;
  referencesTable?: string; // e.g. "users"
  referencesField?: string;  // e.g. "id"
}

export interface DBTable {
  name: string;
  description: string;
  fields: DBField[];
  initialRows: Record<string, any>[]; // Seed data
}

export interface DBSchema {
  tables: DBTable[];
}

export interface UIComponent {
  id: string;
  type: 'StatsCard' | 'DataTable' | 'Form' | 'ActionButton' | 'DetailsPanel' | 'VisualChart' | 'RichText';
  title: string;
  props: {
    // Styling alignment & colors
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info' | 'neutral';
    
    // Binding parameters
    dataSourceTable?: string;  // Bound to local db table
    apiEndpoint?: string;      // Bound to backend endpoint

    // Form fields if type = 'Form'
    fields?: Array<{
      name: string;
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
      required: boolean;
      options?: string[]; // for select dropdowns
    }>;

    // Charts configuration
    chartType?: 'bar' | 'line' | 'pie';
    xAxisKey?: string;
    yAxisKey?: string;

    // Action execution
    triggerAction?: string; // description of what it does
    targetEndpoint?: string; // endpoint invoked on action click
    requiredRole?: string; // Role required to click this button
    
    // Static rich content
    htmlContent?: string;
  };
}

export interface UIPage {
  id: string;
  name: string;
  path: string;
  icon: string; // Lucide icon alias name (e.g., "Users", "Shield", "CreditCard")
  layout: 'dashboard' | 'simple-list' | 'split-view' | 'form-focus' | 'analytics-bento';
  requiredRole?: string; // Gate route access
  description: string;
  components: UIComponent[];
}

export interface UIConfig {
  navigationAppName: string;
  themeColor: string; // e.g. "slate" | "blue" | "emerald" | "violet"
  pages: UIPage[];
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  summary: string;
  requiredRole: string; // Allowed role
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean';
    required: boolean;
    location: 'query' | 'body' | 'path';
  }>;
  dbOperations: Array<{
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'LOG';
    targetTable: string;
    description: string;
  }>;
  mockResponseBody: Record<string, any>;
}

export interface APIConfig {
  endpoints: APIEndpoint[];
}

export interface AuthRules {
  roles: string[]; // List of roles e.g. ["Admin", "StandardUser", "PremiumUser", "Guest"]
  roleHierarchy: string[]; // Order of power, e.g. ["Admin", "PremiumUser", "StandardUser", "Guest"]
  defaultRole: string;
}

export interface AppSchema {
  ui: UIConfig;
  api: APIConfig;
  db: DBSchema;
  auth: AuthRules;
}

// --- 2. PIPELINE RUNTIME LOGGING & ERROR METRICS ---

export type PipelineStage = 'idle' | 'intent' | 'design' | 'schema' | 'refine' | 'completed' | 'failed';

export interface CompilerLog {
  timestamp: string;
  stage: PipelineStage;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  payload?: any;
}

export interface ValidationIssue {
  layer: 'UI' | 'API' | 'DB' | 'Auth' | 'Cross-Layer';
  severity: 'warning' | 'critical';
  rule: string;
  message: string;
  target?: string;
  autoRepaired: boolean;
}

export interface CompilationResult {
  success: boolean;
  prompt: string;
  systemName: string;
  schema: AppSchema | null;
  logs: CompilerLog[];
  validationIssues: ValidationIssue[];
  metrics: {
    durationMs: number;
    totalTokens: number;
    estimatedCostUsd: number;
    retriesCount: number;
  };
}

// --- 3. EVALUATION DATASET DEFINITIONS ---

export interface EvaluationPrompt {
  id: string;
  category: 'real_product' | 'edge_case';
  title: string;
  prompt: string;
  difficulty: 'Medium' | 'High' | 'Extreme';
  expectedFailureType?: string; // for edge cases
  assumptionsRequired?: string[];
}
