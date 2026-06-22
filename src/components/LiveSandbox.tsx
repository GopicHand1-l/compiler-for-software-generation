/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import * as Icons from 'lucide-react';
import { 
  AppSchema, 
  UIComponent, 
  UIPage 
} from '../types';
import { 
  Database, 
  Activity, 
  Lock, 
  ShieldAlert, 
  Globe, 
  Terminal, 
  RefreshCw,
  Plus,
  Trash2,
  Check,
  AlertCircle
} from 'lucide-react';

interface LiveSandboxProps {
  schema: AppSchema | null;
}

export default function LiveSandbox({ schema }: LiveSandboxProps) {
  if (!schema) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-8 flex flex-col items-center justify-center text-center h-[580px] select-none" id="sandbox-empty-prompt-state">
        <Database className="w-12 h-12 text-slate-300 mb-3 animate-pulse" />
        <h3 className="text-sm font-semibold text-slate-700">Sandbox Preview Ready</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Generate a schema by running the compiler pipeline to interact with your validated, fully functional software mock.
        </p>
      </div>
    );
  }

  const { ui, api, db, auth } = schema;
  const roles = auth?.roles || ['Admin', 'StandardUser', 'Guest'];
  const [activeRole, setActiveRole] = useState<string>(auth?.defaultRole || roles[0]);
  const [activePageId, setActivePageId] = useState<string>(ui.pages[0]?.id || '');
  
  // 1. Database Simulated state initialization
  const [dbState, setDbState] = useState<Record<string, any[]>>({});
  const [selectedTableRow, setSelectedTableRow] = useState<any | null>(null);

  // 2. Local API audit logs
  const [apiLogs, setApiLogs] = useState<Array<{
    timestamp: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    roleChecked: string;
    status: number;
    details: string;
  }>>([]);

  // Form input control states relative to forms in preview
  const [formInputs, setFormInputs] = useState<Record<string, any>>({});
  const [activeDbTab, setActiveDbTab] = useState<string>(db.tables[0]?.name || '');

  // Log API helper
  const logApiCall = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, status: number, details: string) => {
    setApiLogs(prev => [
      {
        timestamp: new Date().toLocaleTimeString(),
        method,
        path,
        roleChecked: activeRole,
        status,
        details,
      },
      ...prev.slice(0, 49) // Keep last 50
    ]);
  };

  // Seed DB on compile schema update
  useEffect(() => {
    const initialDb: Record<string, any[]> = {};
    db.tables.forEach(table => {
      initialDb[table.name] = [...(table.initialRows || [])];
    });
    setDbState(initialDb);
    if (db.tables[0]) {
      setActiveDbTab(db.tables[0].name);
    }
    if (ui.pages[0]) {
      setActivePageId(ui.pages[0].id);
    }
    // Initialize default forms state
    setFormInputs({});
    setApiLogs([
      {
        timestamp: new Date().toLocaleTimeString(),
        method: 'GET',
        path: '/api/metadata',
        roleChecked: activeRole,
        status: 200,
        details: 'Initial target ast system loaded successfully.'
      }
    ]);
  }, [schema]);

  // Handle dynamic routing permissions
  // Returns true if simulated active role is authorized
  const hasAccessRole = (requiredRole?: string): boolean => {
    if (!requiredRole) return true;
    
    // Quick hierarchy checks
    const hierarchy = auth?.roleHierarchy || [];
    const activeIndex = hierarchy.indexOf(activeRole);
    const requiredIndex = hierarchy.indexOf(requiredRole);

    if (activeIndex === -1 || requiredIndex === -1) {
      // Direct comparison fallback
      return activeRole.toLowerCase() === requiredRole.toLowerCase();
    }
    // Low index = higher power (e.g. Admin at index 0, User at index 1)
    return activeIndex <= requiredIndex;
  };

  // Safe Lucide icon solver helper
  const renderIconComponent = (iconName: string, className?: string) => {
    const Icon = (Icons as any)[iconName] || Icons.HelpCircle;
    return <Icon className={className || "w-4 h-4"} />;
  };

  const activePage = ui.pages.find(p => p.id === activePageId) || ui.pages[0];

  // Dynamic Event submissions simulator
  const handleFormSubmit = (e: FormEvent, comp: UIComponent) => {
    e.preventDefault();
    const endpointPath = comp.props.targetEndpoint || `/api/form/${comp.id}`;
    
    // Execute auth checked rule
    if (comp.props.requiredRole && !hasAccessRole(comp.props.requiredRole)) {
      logApiCall('POST', endpointPath, 403, `Access Forbidden: Required clearance: [${comp.props.requiredRole}]`);
      alert(`403 Forbidden: Active role does not possess elevation: [${comp.props.requiredRole}]`);
      return;
    }

    const tableBound = comp.props.dataSourceTable;
    if (!tableBound || !dbState[tableBound]) {
      logApiCall('POST', endpointPath, 400, `Bad Request: bound table not found`);
      return;
    }

    // Capture values into db table state
    const fields = comp.props.fields || [];
    const newRecord: Record<string, any> = { id: Math.floor(Math.random() * 90000 + 10000) };
    
    fields.forEach(f => {
      const formKey = `${comp.id}_${f.name}`;
      newRecord[f.name] = formInputs[formKey] || (f.type === 'boolean' ? false : '');
    });

    if (newRecord && Object.keys(newRecord).length > 1) {
      setDbState(prev => ({
        ...prev,
        [tableBound]: [...prev[tableBound], newRecord]
      }));
      
      logApiCall('POST', endpointPath, 201, `Records added to table "${tableBound}". Auto-Calculations updated.`);
      
      // Clear inputs for this form
      const cleared: Record<string, any> = { ...formInputs };
      fields.forEach(f => delete cleared[`${comp.id}_${f.name}`]);
      setFormInputs(cleared);
    }
  };

  // Simulated Action button trigger
  const handleActionTrigger = (comp: UIComponent) => {
    const actionPath = comp.props.targetEndpoint || `/api/action/${comp.id}`;
    
    if (comp.props.requiredRole && !hasAccessRole(comp.props.requiredRole)) {
      logApiCall('POST', actionPath, 403, `Permission Denied: Button require role [${comp.props.requiredRole}]`);
      alert(`403 Gates Active: Required role elevation is "${comp.props.requiredRole}"!`);
      return;
    }

    // Trigger mock response state shifts or deletions
    const boundTable = comp.props.dataSourceTable;
    if (comp.props.triggerAction && comp.props.triggerAction.toLowerCase().includes('delete') && boundTable) {
      // Mock delete last record
      const rows = dbState[boundTable] || [];
      if (rows.length > 0) {
        setDbState(prev => ({
          ...prev,
          [boundTable]: prev[boundTable].slice(0, -1)
        }));
        logApiCall('POST', actionPath, 200, `Action trigger successfully executed. Popped last row in "${boundTable}".`);
      } else {
        logApiCall('POST', actionPath, 404, `No lines left to delete in "${boundTable}".`);
      }
    } else {
      logApiCall('POST', actionPath, 200, `Execution simulated successfully: "${comp.props.triggerAction || comp.title}"`);
    }
  };

  // Interactive dynamic statistics counts
  const calculateStat = (comp: UIComponent): string | number => {
    const table = comp.props.dataSourceTable;
    if (!table || !dbState[table]) return Math.floor(Math.random() * 100 + 20);
    const rows = dbState[table];

    // Check if title mentions dynamic aggregates
    const tLower = comp.title.toLowerCase();
    if (tLower.includes('total') || tLower.includes('value') || tLower.includes('revenue')) {
      // Find the first field mapping to standard numbers representing pricing or values
      const numericField = db.tables.find(t => t.name === table)?.fields.find(f => f.type === 'number')?.name;
      if (numericField) {
        const sum = rows.reduce((acc, row) => acc + (Number(row[numericField]) || 0), 0);
        if (sum > 1000) return `$${(sum).toLocaleString()}`;
        return sum;
      }
    }
    return rows.length;
  };

  const getThemeAccentClass = () => {
    switch (ui.themeColor) {
      case 'blue': return { bg: 'bg-blue-600', hoverBg: 'hover:bg-blue-700', text: 'text-blue-600', ring: 'focus:ring-blue-500', border: 'border-blue-200' };
      case 'violet': return { bg: 'bg-violet-600', hoverBg: 'hover:bg-violet-700', text: 'text-violet-600', ring: 'focus:ring-violet-500', border: 'border-violet-200' };
      case 'slate': return { bg: 'bg-slate-800', hoverBg: 'hover:bg-slate-900', text: 'text-slate-800', ring: 'focus:ring-slate-800', border: 'border-slate-300' };
      default: return { bg: 'bg-emerald-600', hoverBg: 'hover:bg-emerald-700', text: 'text-emerald-600', ring: 'focus:ring-emerald-500', border: 'border-emerald-200' };
    }
  };

  const accent = getThemeAccentClass();

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full" id="comp-live-sandbox">
      
      {/* DEVELOPMENT CONTROL BOARD - SIMULATING AUTH ROLES AND ENV */}
      <div className="bg-slate-900 px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-950 select-none">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold text-slate-200 font-mono uppercase tracking-wider">Live Execution Control</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mock Selector: Active User Role */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-400 font-mono font-bold uppercase">Role Clearance:</label>
            <select
              value={activeRole}
              onChange={(e) => {
                setActiveRole(e.target.value);
                logApiCall('GET', '/api/environment', 200, `Environment swapped perspective identity to: [${e.target.value}]`);
              }}
              className="bg-slate-850 text-slate-200 border border-slate-800 text-[10.5px] rounded px-2 py-0.8 outline-none font-bold"
              id="sandbox-user-role-toggle"
            >
              {roles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-slate-800" />
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">
            Theme: <span className="font-bold underline text-slate-200">{ui.themeColor}</span>
          </span>
        </div>
      </div>

      {/* PRIMARY SIMULATED CLIENT WORKSPACE */}
      <div className="flex-1 flex bg-white min-h-[360px] relative overflow-hidden">
        
        {/* SIDEBAR NAVIGATION PANEL */}
        <div className="w-40 bg-slate-50 border-r border-slate-100 flex flex-col justify-between py-4 select-none shrink-0">
          <div className="space-y-4">
            {/* App Nav Label */}
            <div className="px-4">
              <span className={`text-[10px] uppercase font-mono font-medium ${accent.text} tracking-widest`}>
                {ui.navigationAppName}
              </span>
            </div>
            
            {/* Pages routes mapping */}
            <nav className="space-y-1 px-2">
              {ui.pages.map((page) => {
                const isSelected = activePageId === page.id;
                const isGated = page.requiredRole && !hasAccessRole(page.requiredRole);
                return (
                  <button
                    key={page.id}
                    onClick={() => {
                      setActivePageId(page.id);
                      logApiCall('GET', page.path, 200, `Component layout tree parsed successfully for route: "${page.name}"`);
                    }}
                    className={`w-full text-left py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                      isSelected 
                        ? `${accent.bg} text-white shadow-3xs` 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    id={`sandbox-nav-${page.id}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {renderIconComponent(page.icon, `w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`)}
                      <span className="truncate">{page.name}</span>
                    </div>
                    {isGated && (
                      <Lock className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="px-4">
            <div className="text-[9px] text-slate-400 font-mono leading-relaxed p-2 bg-slate-100 rounded-lg">
              Authorized as: <br />
              <span className="font-bold text-slate-600">{activeRole}</span>
            </div>
          </div>
        </div>

        {/* PAGE CONTENT CONTAINER (WITH SECURITY GATE CHECKS) */}
        <div className="flex-1 p-5 overflow-y-auto max-h-[440px] scrollbar-thin">
          {!hasAccessRole(activePage?.requiredRole) ? (
            
            /* ACCESS GATED BANNER */
            <div className="h-full flex flex-col items-center justify-center p-8 text-center" id="sandbox-page-access-gated">
              <div className="p-3 bg-red-50 text-red-500 rounded-full border border-red-100 mb-3 animate-bounce">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">403 Unauthorized Access Gated</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-normal">
                This section "{activePage?.name}" is security restricted to 
                <span className="font-bold text-red-600 px-1 bg-red-50 rounded mx-1">
                  "{activePage?.requiredRole}"
                </span> 
                role clearance. Elevate your clearance selector above to access this workspace.
              </p>
            </div>
          ) : (
            
            /* DYNAMICALLY RENDERED PAGE COMPONENTS */
            <div className="space-y-5 animate-fade-in" id={`sandbox-viewport-page-${activePage?.id}`}>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  {renderIconComponent(activePage?.icon, "w-4.5 h-4.5 text-slate-600")}
                  <span>{activePage?.name}</span>
                </h2>
                <p className="text-[11px] text-slate-500 leading-normal">{activePage?.description}</p>
              </div>

              {/* Renders Grid depending on Layout */}
              <div className={`grid gap-4 ${
                activePage?.layout === 'analytics-bento' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
              }`}>
                {activePage?.components.map((comp) => {
                  const compGated = comp.props.requiredRole && !hasAccessRole(comp.props.requiredRole);
                  return (
                    <div 
                      key={comp.id} 
                      className={`bg-white border text-slate-800 rounded-xl p-4 shadow-3xs relative overflow-hidden transition-all ${
                        comp.type === 'StatsCard' ? 'col-span-1' : 'col-span-full'
                      } ${compGated ? 'opacity-85 border-slate-200/50 bg-slate-50/50' : 'border-slate-100'}`}
                      id={`sandbox-component-${comp.id}`}
                    >
                      {/* Gated warning on component overlay */}
                      {compGated && (
                        <div className="absolute top-2 right-2 bg-amber-50 rounded-full px-1.5 py-0.5 border border-amber-100 flex items-center gap-0.5 select-none animate-pulse">
                          <Lock className="w-2.5 h-2.5 text-amber-500" />
                          <span className="text-[8px] font-bold text-amber-600 font-mono uppercase">{comp.props.requiredRole} Gated</span>
                        </div>
                      )}

                      <h4 className="text-[12px] font-bold text-slate-850 mt-1 mb-2 tracking-tight flex items-center gap-1 select-none">
                        {comp.type === 'Form' && <Plus className="w-3 text-slate-400 shrink-0"/>}
                        <span>{comp.title}</span>
                      </h4>

                      {/* RENDERING INDIVIDUAL TYPE ENGINES */}
                      
                      {/* Type 1: STATS CARD */}
                      {comp.type === 'StatsCard' && (
                        <div className="mt-1">
                          <div className="text-xl font-extrabold text-slate-900 font-mono">
                            {calculateStat(comp)}
                          </div>
                          <span className="text-[9.5px] text-slate-400 font-mono">
                            Connected to table: "{comp.props.dataSourceTable}"
                          </span>
                        </div>
                      )}

                      {/* Type 2: DATA TABLE */}
                      {comp.type === 'DataTable' && (
                        <div className="overflow-x-auto select-text">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="border-b border-indigo-50/50 text-slate-400 select-none font-bold uppercase text-[9px]">
                                {dbState[comp.props.dataSourceTable || '']?.[0] ? (
                                  Object.keys(dbState[comp.props.dataSourceTable || ''][0]).map(col => col !== 'id' && (
                                    <th key={col} className="pb-1.5 px-2">{col}</th>
                                  ))
                                ) : (
                                  <th className="pb-1 text-slate-400 py-1 font-mono italic">No schema columns found</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {dbState[comp.props.dataSourceTable || '']?.map((row, rIdx) => (
                                <tr 
                                  key={rIdx} 
                                  onClick={() => setSelectedTableRow(row)}
                                  className={`border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer ${
                                    selectedTableRow?.id === row.id ? 'bg-violet-50/30 font-medium' : ''
                                  }`}
                                >
                                  {Object.keys(row).map(col => col !== 'id' && (
                                    <td key={col} className="py-2 px-2 max-w-[140px] truncate">
                                      {typeof row[col] === 'boolean' ? (row[col] ? 'True' : 'False') : String(row[col])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              {(!dbState[comp.props.dataSourceTable || ''] || dbState[comp.props.dataSourceTable || ''].length === 0) && (
                                <tr>
                                  <td colSpan={5} className="py-4 text-center text-slate-400 font-mono">
                                    Empty data rows in target table: "{comp.props.dataSourceTable}"
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          <div className="text-[8.5px] text-slate-400 font-mono mt-1.5 text-right select-none">
                            * Click on any row line to load parameters in audit panels
                          </div>
                        </div>
                      )}

                      {/* Type 3: FORM GENERATOR */}
                      {comp.type === 'Form' && (
                        <form onSubmit={(e) => handleFormSubmit(e, comp)} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {comp.props.fields?.map(field => {
                              const inputKey = `${comp.id}_${field.name}`;
                              return (
                                <div key={field.name} className="space-y-1">
                                  <label className="block text-[10px] text-slate-500 font-semibold">{field.label}</label>
                                  {field.type === 'select' ? (
                                    <select
                                      value={formInputs[inputKey] || ''}
                                      onChange={(e) => setFormInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                      disabled={compGated}
                                      required={field.required}
                                      className="w-full text-xs border border-slate-100 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                      id={`form-input-${inputKey}`}
                                    >
                                      <option value="">-- Choose Option --</option>
                                      {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                  ) : (
                                    <input
                                      type={field.type === 'number' ? 'number' : 'text'}
                                      value={formInputs[inputKey] || ''}
                                      onChange={(e) => setFormInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                      disabled={compGated}
                                      required={field.required}
                                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                                      className="w-full text-xs border border-slate-100 rounded-lg p-2 bg-slate-50/70 focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-800"
                                      id={`form-input-${inputKey}`}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          <button
                            type="submit"
                            disabled={compGated}
                            className={`w-full text-xs font-semibold py-2 rounded-lg text-white transition-all shadow-3xs flex items-center justify-center gap-1.5 ${
                              compGated ? 'bg-slate-300 shadow-none cursor-not-allowed' : `${accent.bg} ${accent.hoverBg}`
                            }`}
                            id={`form-submit-btn-${comp.id}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Submit & Inward Record
                          </button>
                        </form>
                      )}

                      {/* Type 4: ACTION BUTTON TRIGGER */}
                      {comp.type === 'ActionButton' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={compGated}
                            onClick={() => handleActionTrigger(comp)}
                            className={`flex-1 text-xs py-2 px-4 font-bold tracking-tight rounded-xl flex items-center justify-center gap-2 border text-slate-700 transition-all ${
                              compGated 
                                ? 'bg-slate-100 border-slate-200/50 text-slate-400 cursor-not-allowed'
                                : 'bg-white border-slate-200 hover:bg-slate-50 active:scale-98 shadow-xxs'
                            }`}
                            id={`action-btn-trigger-${comp.id}`}
                          >
                            {renderIconComponent(compGated ? "Lock" : "Activity", `w-3.5 h-3.5 ${compGated ? 'text-slate-400' : accent.text}`)}
                            <span>Trigger: {comp.props.triggerAction || comp.title}</span>
                          </button>
                        </div>
                      )}

                      {/* Type 5: VISUAL GRAPH */}
                      {comp.type === 'VisualChart' && (
                        <div className="flex flex-col items-center justify-center py-5 border border-dashed border-indigo-50 rounded-xl bg-slate-50/20">
                          <Icons.TrendingUp className={`w-8 h-8 ${accent.text} mb-1 animate-pulse`} />
                          <span className="text-xs font-extrabold text-slate-800">Dynamic UI Analytics Plotting</span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                            Auto charting bound to table: "{comp.props.dataSourceTable}"
                          </span>
                        </div>
                      )}

                      {/* Type 6: DETAILS PANEL */}
                      {comp.type === 'DetailsPanel' && (
                        <div className="text-[11px] leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                          {selectedTableRow ? (
                            <div className="space-y-1 my-1">
                              <span className="font-bold text-slate-705 uppercase text-[9px] tracking-wider font-mono">Row Attributes Audit:</span>
                              <div className="space-y-1.5 font-mono max-h-24 overflow-y-auto">
                                {Object.keys(selectedTableRow).map(key => (
                                  <div key={key} className="flex justify-between border-b border-slate-100 pb-0.5 last:border-0 text-[10.5px]">
                                    <span className="text-slate-400">{key}:</span>
                                    <span className="font-bold text-slate-700">{String(selectedTableRow[key])}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="py-2 text-center text-slate-400 italic">
                              * Select a row in the data tables above to populate attributes
                            </div>
                          )}
                        </div>
                      )}

                      {/* Default: RICH TEXT / HTML CONTAINER */}
                      {comp.type === 'RichText' && (
                        <div 
                          className="text-[11.5px] text-slate-500 leading-relaxed font-sans"
                          dangerouslySetInnerHTML={{ __html: comp.props.htmlContent || '<span>Parsed standard rich output container successfully</span>' }}
                        />
                      )}

                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER: SIMULATED BACKEND API & DB EXPLORER DRAWER (FOR ADVANCED REALISM) */}
      <div className="bg-slate-900 border-t border-slate-950 flex flex-col h-[200px]" id="sandbox-database-explorer-drawer">
        <div className="px-5 py-2 border-b border-indigo-950 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <Database className="w-3.5 h-3.5 text-violet-400" />
              In-Memory DB Inspector
            </span>
            
            {/* Table selects tabs */}
            <div className="flex gap-1">
              {db.tables.map(table => (
                <button
                  key={table.name}
                  type="button"
                  onClick={() => setActiveDbTab(table.name)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all font-mono ${
                    activeDbTab === table.name 
                      ? 'bg-indigo-600 text-white' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  id={`db-tab-${table.name}`}
                >
                  {table.name} ({dbState[table.name]?.length || 0})
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center text-[10px] text-slate-500 font-mono">
            <span>Sandboxed State Engines</span>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT CHROME: DB ROWS OUTPUT GRID */}
          <div className="flex-1 overflow-auto p-3 h-full border-r border-slate-850 bg-slate-950">
            {dbState[activeDbTab] && dbState[activeDbTab].length > 0 ? (
              <div className="text-[10px] font-mono leading-tight space-y-1">
                {dbState[activeDbTab].map((row, idx) => (
                  <div key={idx} className="border-b border-slate-900 pb-1.5 mb-1.5 last:border-0 hover:bg-slate-900/40 p-1 rounded">
                    <span className="text-[#a3be8c] font-bold">Row #{idx + 1} (id={row.id})</span>: 
                    <span className="text-slate-300 ml-1 select-all">{JSON.stringify(row, null, 1)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 font-mono text-[10px]">
                <span>No rows populated in active collection: "{activeDbTab}"</span>
              </div>
            )}
          </div>

          {/* RIGHT CHROME: SIMULATED BACKEND REQUEST LOGS AUDITOR */}
          <div className="w-72 overflow-y-auto h-full p-3 bg-slate-925/90 select-none text-[10px]">
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 mb-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-slate-200 uppercase font-mono tracking-wider">Simulated REST API auditor</span>
            </div>

            <div className="space-y-2">
              {apiLogs.length === 0 ? (
                <div className="text-slate-600 italic py-2">No system requests cached. Click actions to audit.</div>
              ) : (
                apiLogs.map((log, lIdx) => {
                  const methodColor = log.method === 'GET' ? 'text-blue-400' : 'text-emerald-400';
                  const statusColor = log.status < 300 ? 'text-emerald-500 bg-emerald-950/25 px-1 rounded' : 'text-red-400 bg-red-950/25 px-1 rounded';
                  return (
                    <div key={lIdx} className="leading-normal border-b border-slate-850/50 pb-1.5 font-mono last:border-0">
                      <div className="flex justify-between">
                        <div>
                          <span className={`font-bold ${methodColor}`}>{log.method}</span>
                          <span className="text-slate-300 ml-1.5 select-all">{log.path}</span>
                        </div>
                        <span className={`font-bold ${statusColor}`}>{log.status}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 flex justify-between mt-0.5">
                        <span className="truncate max-w-[120px]">Auth client: "{log.roleChecked}"</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <p className="text-[9px] text-[#81a1c1] line-clamp-1 mt-0.5">↳ {log.details}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
