/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Terminal, 
  Cpu, 
  Layers, 
  TrendingUp, 
  Play, 
  Gauge, 
  Database, 
  Code,
  Sparkles,
  HelpCircle,
  Activity,
  Maximize2
} from 'lucide-react';
import PipelineConsole from './components/PipelineConsole';
import MetricsPanel from './components/MetricsPanel';
import LiveSandbox from './components/LiveSandbox';
import { CompilerLog, PipelineStage, CompilationResult } from './types';

export default function App() {
  // Input parameters
  const [prompt, setPrompt] = useState<string>(
    "Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments. Admins can see analytics."
  );
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [selectedDepth, setSelectedDepth] = useState<'standard' | 'deep'>('standard');

  // Pipeline execution state
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [activeStage, setActiveStage] = useState<PipelineStage>('idle');
  const [logs, setLogs] = useState<CompilerLog[]>([]);
  const [lastResult, setLastResult] = useState<CompilationResult | null>(null);

  // Tab controller for the right side
  const [workspaceTab, setWorkspaceTab] = useState<'sandbox' | 'metrics'>('sandbox');

  // Multi-stage compilation execution trigger
  const handleCompile = async () => {
    if (!prompt.trim() || isCompiling) return;

    setIsCompiling(true);
    setActiveStage('intent');
    setLogs([]);
    setLastResult(null);

    // Initial local logs in the UI helper to trigger immediate reactivity
    const pushLog = (stage: PipelineStage, type: 'info' | 'success' | 'warning' | 'error', message: string) => {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          stage,
          type,
          message,
        },
      ]);
    };

    pushLog('intent', 'info', 'Initializing compiler pipeline container environment...');
    
    try {
      // Trigger backend server multi-agent compiler
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          depth: selectedDepth,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Feed generated logs
        setLogs(result.logs || []);
        setLastResult(result);
        setActiveStage('completed');
        // Auto navigate to sandbox to demonstrate execution success immediately
        setWorkspaceTab('sandbox');
      } else {
        setLogs(result.logs || []);
        setActiveStage('failed');
        pushLog('failed', 'error', `Compilation aborted: ${result.error || 'Syntax constraint failure'}`);
      }
    } catch (err: any) {
      setActiveStage('failed');
      pushLog('failed', 'error', `Compiler Fatal Connection Crash: ${err.message}`);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col text-slate-800 antialiased font-sans">
      
      {/* GLOBAL MASTHEAD / HEADER */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-xxs select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center text-white font-extrabold shadow-sm shadow-violet-200">
            <Cpu className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-slate-950 tracking-tight font-sans">
                AI SOFTWARE COMPILER
              </h1>
              <span className="text-[9px] bg-violet-50 text-violet-600 font-extrabold px-1.5 py-0.5 rounded font-mono border border-violet-100">
                v1.2.0-CORE-V2
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Natural Language → Target Executable AST Framework
            </p>
          </div>
        </div>

        {/* Global telemetry properties */}
        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg p-1.5 px-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Node VM: <span className="font-bold">Cloud Run Target Container (Port 3000)</span></span>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 px-3">
            <span>Server Clock: <span className="font-bold">2026-06-21 GMT-7</span></span>
          </div>
        </div>
      </header>

      {/* CORE CONTENT LAYOUT */}
      <main className="flex-1 max-w-[1360px] mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: CRITICAL COMPILER SETTINGS, BENCHMARKS, PROMPTS (5/12 widths) */}
        <section className="lg:col-span-5 flex flex-col gap-6 h-full lg:max-h-[790px]">
          <PipelineConsole
            prompt={prompt}
            setPrompt={setPrompt}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            selectedDepth={selectedDepth}
            setSelectedDepth={setSelectedDepth}
            isCompiling={isCompiling}
            activeStage={activeStage}
            logs={logs}
            onCompile={handleCompile}
          />
        </section>

        {/* RIGHT COLUMN: LIVE RECTIVE APP ENVIRONMENT SANDBOX & STATISTICAL METRICS (7/12 widths) */}
        <section className="lg:col-span-7 flex flex-col gap-5 h-full min-h-[580px]">
          
          {/* Tabs Controllers */}
          <div className="bg-white border border-slate-150/50 rounded-xl p-1 flex items-center justify-between shadow-2xs select-none shrink-0">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setWorkspaceTab('sandbox')}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-2 ${
                  workspaceTab === 'sandbox'
                    ? 'bg-slate-900 text-white shadow-xxs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                id="tab-sandbox-toggle"
              >
                <Database className="w-3.5 h-3.5" />
                Live Executable App Sandbox
              </button>
              
              <button
                type="button"
                onClick={() => setWorkspaceTab('metrics')}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-2 ${
                  workspaceTab === 'metrics'
                    ? 'bg-slate-900 text-white shadow-xxs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                id="tab-metrics-toggle"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Playground & Token Pricing Analyzers
              </button>
            </div>

            <div className="pr-3 text-[10px] text-slate-400 font-mono">
              Workspace Monitor
            </div>
          </div>

          <div className="flex-1">
            {workspaceTab === 'sandbox' ? (
              <LiveSandbox schema={lastResult?.schema || null} />
            ) : (
              <MetricsPanel lastResult={lastResult} />
            )}
          </div>

        </section>

      </main>

      {/* COMPACT FOOTER */}
      <footer className="bg-white border-t border-slate-100 text-center py-4 text-[10.5px] text-slate-400 font-mono select-none mt-10">
        <p>AI Studio Dev Ingress Platform | Compiled AST Engine Running stand-alone CJS bundles</p>
      </footer>

    </div>
  );
}
