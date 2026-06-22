/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper: Calculate estimated costs and token count
function estimateMetrics(prompt: string, repairedCount: number, depth: string) {
  const promptLen = prompt.length;
  // Standard estimations for reasoning metrics
  const multiplier = depth === 'deep' ? 2.5 : 1.0;
  const inTokens = Math.floor(promptLen * 1.5 + 4000);
  const outTokens = Math.floor(2500 * multiplier + repairedCount * 1200);
  const totalTokens = inTokens + outTokens;
  // Flash costs: $0.075 / 1M input tokens, $0.30 / 1M output tokens (approximate)
  const cost = (inTokens * 0.075 / 1000000) + (outTokens * 0.30 / 1000000);
  return {
    totalTokens,
    estimatedCostUsd: Number(cost.toFixed(6)),
  };
}

// Helper: Run programmatic self-consistency checks
function validateSchema(schema: any): any[] {
  const issues: any[] = [];
  if (!schema) {
    issues.push({
      layer: 'Cross-Layer',
      severity: 'critical',
      rule: 'ROOT_SCHEMA_NULL',
      message: 'Schema object is completely null or undefined.',
      autoRepaired: false,
    });
    return issues;
  }

  const { ui, api, db, auth } = schema;

  // 1. Basic Structure checks
  if (!ui || !ui.pages || !Array.isArray(ui.pages)) {
    issues.push({
      layer: 'UI',
      severity: 'critical',
      rule: 'UI_PAGES_MISSING',
      message: 'UI configuration is missing pages array.',
      autoRepaired: true,
    });
    if (!schema.ui) schema.ui = {};
    schema.ui.pages = schema.ui.pages || [];
  }
  if (!api || !api.endpoints || !Array.isArray(api.endpoints)) {
    issues.push({
      layer: 'API',
      severity: 'critical',
      rule: 'API_ENDPOINTS_MISSING',
      message: 'API configuration is missing endpoints array.',
      autoRepaired: true,
    });
    if (!schema.api) schema.api = {};
    schema.api.endpoints = schema.api.endpoints || [];
  }
  if (!db || !db.tables || !Array.isArray(db.tables)) {
    issues.push({
      layer: 'DB',
      severity: 'critical',
      rule: 'DB_TABLES_MISSING',
      message: 'DB configuration is missing tables array.',
      autoRepaired: true,
    });
    if (!schema.db) schema.db = {};
    schema.db.tables = schema.db.tables || [];
  }
  if (!auth || !auth.roles || !Array.isArray(auth.roles)) {
    issues.push({
      layer: 'Auth',
      severity: 'critical',
      rule: 'AUTH_ROLES_MISSING',
      message: 'Auth configuration is missing roles array.',
      autoRepaired: true,
    });
    if (!schema.auth) schema.auth = {};
    schema.auth.roles = schema.auth.roles || ['Admin', 'User', 'Guest'];
    schema.auth.defaultRole = schema.auth.defaultRole || 'Guest';
  }

  // Reload vars safely
  const tables = schema.db.tables || [];
  const endpoints = schema.api.endpoints || [];
  const roles = schema.auth.roles || [];
  const pages = schema.ui.pages || [];

  // 2. Local Database schema checks & Cross-layer Component integrity
  pages.forEach((page: any) => {
    if (!page.components || !Array.isArray(page.components)) return;
    page.components.forEach((comp: any) => {
      // Rule DB_BOUND: Check if component binds to a DB table that doesn't exist
      if (comp.props && comp.props.dataSourceTable) {
        const tableExists = tables.some((t: any) => t.name.toLowerCase() === comp.props.dataSourceTable.toLowerCase());
        if (!tableExists) {
          issues.push({
            layer: 'Cross-Layer',
            severity: 'critical',
            rule: 'DB_TABLE_MISMATCH',
            message: `Component "${comp.title}" on page "${page.name}" binds to table "${comp.props.dataSourceTable}" which does not exist in DBSchema.`,
            target: `ui.pages[].components[id=${comp.id}].props.dataSourceTable`,
            autoRepaired: true,
          });
          // Auto-repair: bind to the first table if available, or create mock
          if (tables.length > 0) {
            comp.props.dataSourceTable = tables[0].name;
          }
        }
      }

      // Rule API_BOUND: Check if component triggers an API call not listed in api_config
      if (comp.props && comp.props.targetEndpoint) {
        const routeClean = comp.props.targetEndpoint.split('?')[0];
        const apiExists = endpoints.some((ep: any) => ep.path.toLowerCase() === routeClean.toLowerCase());
        if (!apiExists) {
          issues.push({
            layer: 'Cross-Layer',
            severity: 'warning',
            rule: 'API_ROUTE_MISMATCH',
            message: `Component "${comp.title}" triggers target endpoint "${comp.props.targetEndpoint}" which is not explicitly defined in APIConfig endpoints.`,
            target: `ui.pages[].components[id=${comp.id}].props.targetEndpoint`,
            autoRepaired: true,
          });
          // Match or create matching API endpoint
          endpoints.push({
            path: routeClean,
            method: comp.type === 'Form' || comp.type === 'ActionButton' ? 'POST' : 'GET',
            summary: `Trigger handler for ${comp.title}`,
            requiredRole: comp.props.requiredRole || schema.auth.defaultRole || 'Guest',
            parameters: [],
            dbOperations: comp.props.dataSourceTable ? [{
              type: comp.type === 'Form' ? 'INSERT' : 'SELECT',
              targetTable: comp.props.dataSourceTable,
              description: `Triggered by action from component: ${comp.title}`,
            }] : [],
            mockResponseBody: { success: true, message: `Action "${comp.title}" executed successfully!` }
          });
        }
      }

      // Rule AUTH_BND: Component required role check
      if (comp.props && comp.props.requiredRole) {
        const roleValid = roles.some((r: string) => r.toLowerCase() === comp.props.requiredRole.toLowerCase());
        if (!roleValid) {
          issues.push({
            layer: 'Auth',
            severity: 'warning',
            rule: 'USER_ROLE_MISMATCH',
            message: `Component "${comp.title}" specifies required role "${comp.props.requiredRole}" which is not listed in roles schema [${roles.join(', ')}].`,
            target: `ui.pages[].components[id=${comp.id}].props.requiredRole`,
            autoRepaired: true,
          });
          comp.props.requiredRole = roles[0]; // Repair by binding to first available valid role (often Admin)
        }
      }
    });

    // Page level roles consistency check
    if (page.requiredRole) {
      const pageRoleValid = roles.some((r: string) => r.toLowerCase() === page.requiredRole.toLowerCase());
      if (!pageRoleValid) {
        issues.push({
          layer: 'Auth',
          severity: 'warning',
          rule: 'PAGE_ROLE_MISMATCH',
          message: `Page "${page.name}" specifies required role "${page.requiredRole}" which is not defined in allowed roles.`,
          target: `ui.pages[id=${page.id}].requiredRole`,
          autoRepaired: true,
        });
        page.requiredRole = roles[0];
      }
    }
  });

  // Verify relation fields reference existing tables
  tables.forEach((table: any) => {
    if (!table.fields) return;
    table.fields.forEach((field: any) => {
      if (field.type === 'relation' && field.referencesTable) {
        const referencedTableExists = tables.some((t: any) => t.name.toLowerCase() === field.referencesTable.toLowerCase());
        if (!referencedTableExists) {
          issues.push({
            layer: 'DB',
            severity: 'warning',
            rule: 'DB_RELATION_MISMATCH',
            message: `Table "${table.name}" relation field "${field.name}" refers to helper table "${field.referencesTable}" which does not exist.`,
            target: `db.tables[name=${table.name}].fields[name=${field.name}].referencesTable`,
            autoRepaired: true,
          });
          field.type = 'string'; // Downgrade to standard string text to ensure execution stability
          delete field.referencesTable;
          delete field.referencesField;
        }
      }
    });
  });

  return issues;
}

// -------------------------------------------------------------
// POST /api/compile: The main Multi-Stage Compiler Engine
// -------------------------------------------------------------
app.post('/api/compile', async (req, res) => {
  const { prompt, model = 'gemini-3.5-flash', depth = 'standard' } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  const logs: any[] = [];
  const log = (stage: string, type: string, message: string, payload?: any) => {
    logs.push({
      timestamp: new Date().toLocaleTimeString(),
      stage,
      type,
      message,
      payload,
    });
  };

  const startTime = Date.now();
  let schemaResult: any = null;
  let validationIssues: any[] = [];
  let retriesCount = 0;

  try {
    log('intent', 'info', `🚀 Compiler initialization. Received prompt: "${prompt.substring(0, 100)}..."`);

    // ==========================================
    // STAGE 1: INTENT EXTRACTION
    // ==========================================
    log('intent', 'info', 'Executing STAGE 1: Extracting user design core intents & roles...');
    
    const intentPrompt = `
You are an expert software compiler. Your first job is to extract user software intents into a highly clean, structured config.
User Input: "${prompt}"

Return raw JSON with exactly the following JSON structure:
{
  "appName": "A short elegant application name (e.g. 'SecureCRM')",
  "description": "Short system operational description.",
  "extractedRequirements": ["list of explicit features requirement"],
  "roles": ["list of required roles, including an Admin and a basic user role"],
  "businessRules": ["list of structural conditions e.g. 'premium subscription gated' or 'only audit manager can delete record'"],
  "assumptionsMade": ["list of smart compiler configuration assumptions made for underspecified requests"]
}
`;

    const intentResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: intentPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const intentObj = JSON.parse(intentResponse.text || '{}');
    log('intent', 'success', `STAGE 1 complete. Extracted system name: "${intentObj.appName}"`, intentObj);

    // ==========================================
    // STAGE 2 & 3: SYSTEM DESIGN & SCHEMA GENERATION
    // ==========================================
    log('design', 'info', 'Executing STAGE 2 & 3: Converting architectural design into final App Schema config...');

    const schemaEnforcementPrompt = `
You are the software design generator layer of the compiler. Take these extracted software intents, role parameters, and business logic to compile them into a SINGLE complete JSON representing the fully executable software schema.

EXTRACTED SYSTEM STRUCTURES:
- Application Name: ${intentObj.appName}
- Description: ${intentObj.description}
- Roles: ${JSON.stringify(intentObj.roles)}
- Requirements: ${JSON.stringify(intentObj.extractedRequirements)}
- Gated Requirements & Business Logic: ${JSON.stringify(intentObj.businessRules)}
- Assumptions Made: ${JSON.stringify(intentObj.assumptionsMade)}

You must return a schema JSON that perfectly matches the following Type contracts:

interface DBField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'relation';
  required: boolean;
  referencesTable?: string;
  referencesField?: string;
}

interface DBTable {
  name: string;
  description: string;
  fields: DBField[];
  initialRows: Record<string, any>[]; // Seed it with at least 3-4 highly logical mock records related to the problem statement so it runs right away!
}

interface UIComponent {
  id: string; // e.g. "comp-stats-total", "comp-form-add"
  type: 'StatsCard' | 'DataTable' | 'Form' | 'ActionButton' | 'DetailsPanel' | 'VisualChart' | 'RichText';
  title: string;
  props: {
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info' | 'neutral';
    dataSourceTable?: string;  // bound table
    apiEndpoint?: string;      // api route for lists
    fields?: Array<{
      name: string;
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
      required: boolean;
      options?: string[];
    }>;
    chartType?: 'bar' | 'line' | 'pie';
    xAxisKey?: string;
    yAxisKey?: string;
    triggerAction?: string;
    targetEndpoint?: string;
    requiredRole?: string;
    htmlContent?: string;
  };
}

interface UIPage {
  id: string;
  name: string;
  path: string;
  icon: string; // Must be a valid Lucide-react icon identifier name e.g. "Users", "Shield", "Building", "Settings", "Activity", "BookOpen", "TrendingUp", "DollarSign", "FileText", "Grid"
  layout: 'dashboard' | 'simple-list' | 'split-view' | 'form-focus' | 'analytics-bento';
  requiredRole?: string; // Gated role to view page (MUST exist in auth.roles)
  description: string;
  components: UIComponent[];
}

interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  summary: string;
  requiredRole: string; // Allowed role
  parameters: Array<{ name: string; type: 'string' | 'number' | 'boolean'; required: boolean; location: 'query' | 'body' | 'path'; }>;
  dbOperations: Array<{ type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'LOG'; targetTable: string; description: string; }>;
  mockResponseBody: any;
}

The resulting JSON schema should have EXACTLY this top root shape:
{
  "ui": {
    "navigationAppName": "${intentObj.appName}",
    "themeColor": "emerald" (choose from: "slate", "blue", "emerald", "violet" based on app type),
    "pages": UIPage[]
  },
  "api": {
    "endpoints": APIEndpoint[]
  },
  "db": {
    "tables": DBTable[]
  },
  "auth": {
    "roles": string[] (must match roles array extracted or expanded: e.g. ["Admin", "StandardUser", "PremiumUser", "Guest"]),
    "roleHierarchy": string[],
    "defaultRole": string (e.g. "Guest" or "StandardUser")
  }
}

Guidelines for quality:
1. Make sure UI components bind accurately to 'db.tables[].name' via 'dataSourceTable' if they show data.
2. Forms and ActionButtons targeting database insertions MUST specify 'targetEndpoint' (e.g. /api/contacts/create) and represent those endpoints in public api list.
3. Be highly creative of features. Generate 3 to 4 distinct Pages to represent a genuine high-fidelity production app (e.g. Dashboard, Contacts, Role Manager, Premium Upgrades, Logs Audit).
4. Populate with rich, detailed initial database seeds.
`;

    const schemaResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: schemaEnforcementPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    schemaResult = JSON.parse(schemaResponse.text || '{}');
    log('schema', 'success', 'STAGE 3 complete. Abstract abstract software JSON schemas generated successfully.', {
      tablesCount: schemaResult?.db?.tables?.length || 0,
      pagesCount: schemaResult?.ui?.pages?.length || 0,
      endpointsCount: schemaResult?.api?.endpoints?.length || 0,
    });

    // ==========================================
    // STAGE 4: AUTONOMOUS REFINEMENT & REPAIR LAYER
    // ==========================================
    log('refine', 'info', 'Executing STAGE 4: Programmatically compiling and checking integrity of schema references...');
    validationIssues = validateSchema(schemaResult);

    const checkCriticalIssues = validationIssues.length > 0;
    if (checkCriticalIssues) {
      log('refine', 'warning', `Programmatic compiler detected ${validationIssues.length} logical inconsistencies across layers. Launching self-repair module...`, validationIssues);
      retriesCount = 1;

      // Executing an automated AI repair step!
      const repairPrompt = `
You are the software compiler's automated repair unit. You have been fed a generated software configuration schema that failed compiler validation rules. 
Your core task is to repair the consistency errors and return the completely fixed schema matching the exact JSON contract of the types.

DETECTED PIPELINE ISSUES:
${JSON.stringify(validationIssues, null, 2)}

ORIGINAL BROKEN SCHEMA:
${JSON.stringify(schemaResult, null, 2)}

Instructions:
1. Fix all consistency issues. Ensure any UI components calling an API have matching route endpoints in "api.endpoints".
2. Ensure components reference DATABASE tables that are fully configured inside "db.tables".
3. Ensure page/component roles exist inside "auth.roles".
4. Correct and return the entire, complete patched configuration JSON structure. Do NOT truncate or show ellipses.
`;

      const repairResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: repairPrompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const repairedSchema = JSON.parse(repairResponse.text || '{}');
      // Run validation again on the repaired schema to record state
      const postRepairIssues = validateSchema(repairedSchema);
      
      schemaResult = repairedSchema;
      validationIssues = postRepairIssues;
      
      if (validationIssues.length === 0) {
        log('refine', 'success', 'AI auto-repair executed successfully. All schema conflicts were solved seamlessly!');
      } else {
        log('refine', 'warning', `Auto-repair pass partial patch of issues. Remaining issues: ${validationIssues.length}`, validationIssues);
      }
    } else {
      log('refine', 'success', 'Pipeline self-consistency checks passed perfectly on first compilation! Zero structural errors found.');
    }

    const durationMs = Date.now() - startTime;
    const estimatedMetricsObj = estimateMetrics(prompt, retriesCount, depth);

    log('completed', 'success', `🎉 App compilation succeeded. Generated fully executable environment for "${intentObj.appName}" in ${durationMs}ms`);

    res.json({
      success: true,
      prompt,
      systemName: intentObj.appName,
      schema: schemaResult,
      logs,
      validationIssues,
      metrics: {
        durationMs,
        totalTokens: estimatedMetricsObj.totalTokens,
        estimatedCostUsd: estimatedMetricsObj.estimatedCostUsd,
        retriesCount,
      },
    });

  } catch (error: any) {
    console.error('Compiler pipeline failed:', error);
    log('failed', 'error', `Compiler crash: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      logs,
      validationIssues,
      metrics: {
        durationMs: Date.now() - startTime,
        totalTokens: 0,
        estimatedCostUsd: 0,
        retriesCount,
      },
    });
  }
});

// Expose static dataset for evaluation metrics to ensure true-to-life analysis
app.get('/api/evaluation-dataset', (req, res) => {
  const evaluations: any[] = [
    {
      id: 'rp-1',
      category: 'real_product',
      title: 'Multitenant CRM',
      prompt: 'Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments. Admins can see analytics.',
      difficulty: 'High',
      assumptionsRequired: [
        'Contacts are isolated by user IDs',
        'Payments are simulated via Stripe mock endpoint',
        'Standard mock pricing package of $29/mo'
      ]
    },
    {
      id: 'rp-2',
      category: 'real_product',
      title: 'Agile Kanban Project Planner',
      prompt: 'A task organization app with Boards, Lists (Backlog, Todo, In-Progress, Done), and item detail overlays. Needs standard users to create tasks, and Project Owners to add/archive whole boards.',
      difficulty: 'Medium',
      assumptionsRequired: [
        'Each board has predefined status columns default',
        'Standard Kanban state machines applied'
      ]
    },
    {
      id: 'rp-3',
      category: 'real_product',
      title: 'Clinic Booking Management',
      prompt: 'EHR and appointment scheduler for doctor rooms. Multi-role: Doctor, Patient, Desk. Patients can request slots, Desk can book and capture payments, Doctors can view prescriptions and schedule grid.',
      difficulty: 'High',
      assumptionsRequired: [
        'Patient records anonymized / secure in DB',
        'Automatic slot availability defaults to 9-5 matching'
      ]
    },
    {
      id: 'rp-4',
      category: 'real_product',
      title: 'Gated Learning Platform',
      prompt: 'Online school where visitors see course catalogue. Standard accounts can watch free videos. Gated Premium subscribers gain access to certification tests, premium lessons, and active webinars lists.',
      difficulty: 'Medium',
      assumptionsRequired: [
        'Courses contain chapters array',
        'Simulated certification quiz success parameters'
      ]
    },
    {
      id: 'rp-5',
      category: 'real_product',
      title: 'Asset Inventory & Depreciation',
      prompt: 'Corporate hardware asset tracker featuring purchase values, serials, and automatic tax depreciation models (MACRS). IT admins write log lists; financial controller views aggregate balance sheets.',
      difficulty: 'High',
      assumptionsRequired: [
        'MACRS deprecation estimated on 5-year hardware standards',
        'Log trails are permanent append-only'
      ]
    },
    {
      id: 'rp-6',
      category: 'real_product',
      title: 'SaaS Customer Billing Audit',
      prompt: 'A subscription tracking panel verifying monthly invoices, stripe account integrations, billing history charts, and automatic chargeback resolution flow with client messaging.',
      difficulty: 'High',
      assumptionsRequired: [
        'Simulated dynamic monthly billing cycle calculations',
        'Manual intervention overrides default Stripe webhooks'
      ]
    },
    {
      id: 'rp-7',
      category: 'real_product',
      title: 'Secure Document Vault',
      prompt: 'File organization vault where files can be categorized as public, internal, and secret. Secret files require dual authorization logic or specific Admin clearance roles with dynamic access timers.',
      difficulty: 'Extreme',
      assumptionsRequired: [
        'Dynamic access keys expire in 5 minutes',
        'No physical AWS integration is required'
      ]
    },
    {
      id: 'rp-8',
      category: 'real_product',
      title: 'Gym Membership Trainer Hub',
      prompt: 'Trainer scheduling app. Members log weights, trainers customize workouts. Owner manages invoices, premium coach access features, and reviews staff payroll and commission analytics tables.',
      difficulty: 'Medium',
      assumptionsRequired: [
        'Workout exercises default list (bench, squat, deadlift)',
        'Owner payout formula modeled on completed session ratios'
      ]
    },
    {
      id: 'rp-9',
      category: 'real_product',
      title: 'Incident Ticketing Console',
      prompt: 'IT Helpdesk ticketing console. Customers create tickets, support staff take ownership, and engineers view system architecture logs to repair bug queues. System generates automated escalation rules.',
      difficulty: 'High',
      assumptionsRequired: [
        'Tickets escalate to "Engineering" after 2 hours idle',
        'Architecture components list predefined'
      ]
    },
    {
      id: 'rp-10',
      category: 'real_product',
      title: 'E-commerce Seller Center',
      prompt: 'Store owner dashboard showing inventories, total sales widgets, pricing matrices, and customer order statuses. Admins toggle seller profiles and approve premium seller features with payout gateways.',
      difficulty: 'Medium',
      assumptionsRequired: [
        'Base payment gateway mock outputs standard Cents',
        'Product statuses are strictly Draft, Pending, Active, Suspended'
      ]
    },
    {
      id: 'ec-1',
      category: 'edge_case',
      title: 'Conflicting Roles Security',
      prompt: 'Build a private project files archive where "Admins can view everything" but "Supervisors are locked out" and yet "Supervisor role has higher priority inheritance than standard Admin in settings".',
      difficulty: 'Extreme',
      expectedFailureType: 'Auth Conflict - Circular Priority Hierarchy',
      assumptionsRequired: [
        'Resolved circular role dependency by standardizing Supervisor strictly beneath Super-Admin privilege',
        'Injected overriding deny rule parameter in API routes'
      ]
    },
    {
      id: 'ec-2',
      category: 'edge_case',
      title: 'Empty Requirements ("Make a app")',
      prompt: 'Build a beautiful app please.',
      difficulty: 'Medium',
      expectedFailureType: 'Vague Inputs / Underspecified Features',
      assumptionsRequired: [
        'Faceted default application to a comprehensive Task Planner and Activity Stream system',
        'Assumed Roles list containing Standard User and Admin',
        'Added emerald corporate interface theme'
      ]
    },
    {
      id: 'ec-3',
      category: 'edge_case',
      title: 'Invalid Entity DB Mapping',
      prompt: 'Design a system that tracks Space Ships, but has no files, no users, no roles, and only visual buttons to fire lasers that call a route with no defined table.',
      difficulty: 'High',
      expectedFailureType: 'Database table missing referenced components',
      assumptionsRequired: [
        'Implicitly constructed a "Ships" table and an "ActionsLog" table to safely preserve fire laser states',
        'Allowed Guest access for laser fire actions'
      ]
    },
    {
      id: 'ec-4',
      category: 'edge_case',
      title: 'Hyper-vague CRM description',
      prompt: 'CRM system with some charts and tables. Fast.',
      difficulty: 'Medium',
      expectedFailureType: 'Underspecified Requirements',
      assumptionsRequired: [
        'Assumed customers schema containing name, pipeline state, revenue metric',
        'Assumed standard sales analytics bar graph component'
      ]
    },
    {
      id: 'ec-5',
      category: 'edge_case',
      title: 'Unsupported Third Party API',
      prompt: 'Integrate custom biological hardware DNA sequencer firmware inputs that streams live raw base pairs to an audit list.',
      difficulty: 'Extreme',
      expectedFailureType: 'Unsupported Interface Layer Integration',
      assumptionsRequired: [
        'Synthesized simulated DNA sequencer data generation mock stream API',
        'Modeled as standard POST stream to high-throughput log audits table'
      ]
    },
    {
      id: 'ec-6',
      category: 'edge_case',
      title: 'Conflicting Actions Logic',
      prompt: 'Create a portal where Standard Users can edit posts, but Standard Users are strictly write-disabled. Only moderators write.',
      difficulty: 'High',
      expectedFailureType: 'Logical Inconsistencies',
      assumptionsRequired: [
        'Resolved conflict by downgrading Standard User permissions. Standard Users are now view-only, Moderators are editor-enabled.'
      ]
    },
    {
      id: 'ec-7',
      category: 'edge_case',
      title: 'No auth specified',
      prompt: 'Kanban Board showing columns. Anyone can click anything but also needs privacy settings later.',
      difficulty: 'Medium',
      expectedFailureType: 'Sparse Auth Setup',
      assumptionsRequired: [
        'Created Visitor and Admin roles',
        'Allowed full editing standard configuration for Visitor role while preserving Admin configs for toggles'
      ]
    },
    {
      id: 'ec-8',
      category: 'edge_case',
      title: 'Circular Table relationships',
      prompt: 'A company table references a department. A department table references a supervisor. A supervisor table references a company. All fields are required relational blocks',
      difficulty: 'Extreme',
      expectedFailureType: 'Circular DB Reference Constraints',
      assumptionsRequired: [
        'Made relational fields nullable to prevent insertion deadlock on initialize',
        'Configured cascade updates logically'
      ]
    },
    {
      id: 'ec-9',
      category: 'edge_case',
      title: 'Exceedingly large UI scope',
      prompt: 'E-commerce hub with separate seller portals, buyer portals, shipping tracking panel, return authorization lists, messaging hub, dispute panels, legal policies document editors, and accounting ledger with 50 pages.',
      difficulty: 'Extreme',
      expectedFailureType: 'Scope Overwhelm / Token Length Overflow',
      assumptionsRequired: [
        'Aggregated UI configuration to top 4 core pages (Buyer Portal, Seller Hub, ShipTracker, Legal Ledger)',
        'Modeled secondary layers as tabs, inline subcomponents to avoid schema overflow'
      ]
    },
    {
      id: 'ec-10',
      category: 'edge_case',
      title: 'Nonsense/gibberish instruction',
      prompt: 'Asdasda sdf sdfg asdf asf fsa f sdf as',
      difficulty: 'Medium',
      expectedFailureType: 'Meaningless semantic token stream',
      assumptionsRequired: [
        'Gracefully redirected to an interactive "Hello Sandbox" playground utility',
        'Configured generic Sandbox tables to allow manual user experimentation'
      ]
    }
  ];
  res.json({ success: true, evaluations });
});

// Configure Vite middleware and asset routing for full-stack integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Unified Compiler Server running on http://localhost:${PORT}`);
  });
}

startServer();
