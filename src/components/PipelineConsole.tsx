/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Play, 
  Sparkles, 
  Code, 
  Database, 
  FileJson, 
  Tv, 
  Terminal, 
  AlertCircle,
  Clock,
  Coins,
  Cpu,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { EvaluationPrompt, CompilerLog, PipelineStage } from '../types';

interface PipelineConsoleProps {
  prompt: string;
  setPrompt: (v: string) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  selectedDepth: 'standard' | 'deep';
  setSelectedDepth: (v: 'standard' | 'deep') => void;
  isCompiling: boolean;
  activeStage: PipelineStage;
  logs: CompilerLog[];
  onCompile: () => void;
}

export default function PipelineConsole({
  prompt,
  setPrompt,
  selectedModel,
  setSelectedModel,
  selectedDepth,
  setSelectedDepth,
  isCompiling,
  activeStage,
  logs,
  onCompile,
}: PipelineConsoleProps) {
  const [activeTab, setActiveTab] = useState<'real' | 'edge'>('real');
  const [evalPrompts, setEvalPrompts] = useState<EvaluationPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');

  // Fetch presets from the backend evaluation dataset
  useEffect(() => {
    fetch('/api/evaluation-dataset')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setEvalPrompts(data.evaluations);
        }
      })
      .catch((err) => console.error('Failed to load evaluation dataset:', err));
  }, []);

  const handleSelectPreset = (p: EvaluationPrompt) => {
    setPrompt(p.prompt);
    setSelectedPromptId(p.id);
  };

  const currentStagePercentage = () => {
    switch (activeStage) {
      case 'intent': return 25;
      case 'design': return 50;
      case 'schema': return 75;
      case 'refine': return 90;
      case 'completed': return 100;
      case 'failed': return 100;
      default: return 0;
    }
  };

  const getStageLabel = () => {
    switch (activeStage) {
      case 'intent': return 'STAGE 1: Intent Extraction & Goal Mapping';
      case 'design': return 'STAGE 2: System Architecture Design';
      case 'schema': return 'STAGE 3: Output Schema Constraints Generation';
      case 'refine': return 'STAGE 4: Autonomous Cross-layer Consistency Checks';
      case 'completed': return 'Compilation Completed';
      case 'failed': return 'Compilation Terminated with Error';
      default: return 'IDLE: Ready for Synthesis';
    }
  };

  const filteredPrompts = evalPrompts.filter(p => 
    activeTab === 'real' ? p.category === 'real_product' : p.category === 'edge_case'
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full" id="comp-pipeline-console">
      {/* Tab: Compiler Config & Prompt Panel */}
      <div className="p-5 border-b border-slate-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
              <Code className="w-5 h-5" id="comp-pipeline-icon-code"/>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Compiler Settings</h2>
              <p className="text-[11px] text-slate-500 font-mono">Parameters & Constraint Decoders</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-600 font-medium px-2 py-0.5 bg-emerald-50 rounded-full font-mono">
              ● Server API Active
            </span>
          </div>
        </div>

        {/* Model Selection & Parameters */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold font-mono mb-1.5">Acoustic Model Engine</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isCompiling}
              className="w-full text-xs font-medium border border-slate-100 rounded-lg p-2 bg-slate-50/50 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
              id="model-selector-field"
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Latency Optimized)</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Reasoning Optimized)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold font-mono mb-1.5">Processing Depth</label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-50/50 border border-slate-100 rounded-lg p-0.5" id="depth-toggles">
              <button
                type="button"
                onClick={() => setSelectedDepth('standard')}
                disabled={isCompiling}
                className={`py-1 rounded-md text-[11px] font-medium transition-all ${
                  selectedDepth === 'standard'
                    ? 'bg-white shadow-xs text-slate-800 border border-slate-100'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setSelectedDepth('deep')}
                disabled={isCompiling}
                className={`py-1 rounded-md text-[11px] font-medium transition-all ${
                  selectedDepth === 'deep'
                    ? 'bg-white shadow-xs text-slate-800 border border-slate-100'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Deep Trace
              </button>
            </div>
          </div>
        </div>

        {/* Input prompt config */}
        <div className="space-y-1.5">
          <label className="block text-[10px] text-slate-400 uppercase font-semibold font-mono">
            Source Code Natural Instructions
          </label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setSelectedPromptId('');
              }}
              disabled={isCompiling}
              rows={4}
              placeholder="E.g., Build a CRM with login, contacts dashboard, role hierarchy, and active stripe premium payment gateways. Doctors or patients scheduling system slots..."
              className="w-full text-xs border border-slate-100 hover:border-slate-200 focus:border-violet-500 rounded-xl p-3 bg-slate-50/20 shadow-xxs font-sans text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all resize-none leading-relaxed"
              id="compiler-prompt-textarea"
            />
            {isCompiling && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xxs flex items-center justify-center rounded-xl">
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 text-violet-600 animate-spin" />
                  <span className="text-xs font-medium text-slate-600 font-mono">Compiling instructions...</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onCompile}
              disabled={isCompiling || !prompt.trim()}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-tight shadow-md transition-all ${
                isCompiling || !prompt.trim()
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200/50'
                  : 'bg-violet-600 hover:bg-violet-700 active:scale-98 text-white hover:shadow-violet-200/50'
              }`}
              id="compile-submit-button"
            >
              {isCompiling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Target AST...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current text-white" />
                  <span>Execute Compiler Pipeline</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dataset evaluations Tab */}
      <div className="flex-1 min-h-[180px] flex flex-col border-b border-slate-50 bg-slate-50/20">
        <div className="px-5 pt-3 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <h3 className="text-xs font-semibold text-slate-700">Pre-seeded Sandbox Scenarios</h3>
          </div>
          <div className="flex border border-slate-100 rounded-lg p-0.5 bg-slate-100/50 select-none">
            <button
              type="button"
              onClick={() => setActiveTab('real')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                activeTab === 'real' ? 'bg-white shadow-xxs text-slate-800' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              10 Real Apps
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('edge')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                activeTab === 'edge' ? 'bg-white shadow-xxs text-slate-800' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              10 Edge Cases
            </button>
          </div>
        </div>

        {/* Live List Scroll */}
        <div className="p-3 overflow-y-auto flex-1 max-h-[190px] space-y-2 scrollbar-thin">
          {filteredPrompts.map((p) => {
            const isSelected = selectedPromptId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 ${
                  isSelected 
                    ? 'bg-violet-50/50 border-violet-200 shadow-xxs ring-1 ring-violet-200' 
                    : 'bg-white border-slate-100 hover:border-slate-200 shadow-3xs'
                }`}
                id={`preset-btn-${p.id}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold text-slate-800 truncate max-w-[190px]">{p.title}</span>
                  <div className="flex items-center gap-1.5">
                    {p.expectedFailureType && (
                      <span className="text-[9px] bg-amber-50 text-amber-600 font-bold px-1 py-0.5 rounded font-mono border border-amber-100">
                        Edge
                      </span>
                    )}
                    <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-sm ${
                      p.difficulty === 'Extreme' ? 'bg-rose-50 text-rose-600' : p.difficulty === 'High' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                    }`}>
                      {p.difficulty}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-normal line-clamp-1 leading-normal italic">
                  "{p.prompt}"
                </p>
                {isSelected && p.assumptionsRequired && p.assumptionsRequired.length > 0 && (
                  <div className="mt-1 pt-1 border-t border-violet-100 text-[9px] text-violet-700/80 font-mono">
                    <span className="font-bold">Resolver Assumptions:</span> {p.assumptionsRequired.join(' | ')}
                  </div>
                )}
                {isSelected && p.expectedFailureType && (
                  <div className="mt-1 pt-1 border-t border-amber-100 text-[9px] text-amber-700 font-mono">
                    <span className="font-bold">Expected Conflict resolved:</span> {p.expectedFailureType}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compiler pipeline Stage animation/logs */}
      <div className="p-4 bg-slate-900 text-slate-300 font-mono text-[11px] h-[210px] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">Terminal AST Stage Logs</span>
          </div>
          <span className="text-[10px] text-slate-500">Output Log Stream</span>
        </div>

        {/* Live Stage Progress */}
        <div className="mb-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span className="truncate max-w-[190px] font-bold text-[#b48ead]">{getStageLabel()}</span>
            <span>{currentStagePercentage()}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              style={{ width: `${currentStagePercentage()}%` }}
              className="h-full bg-violet-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]"
            />
          </div>
        </div>

        {/* Streaming Code Logs panel */}
        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin text-[10px] p-1.5 bg-slate-950/80 border border-slate-850 rounded-lg">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 py-4">
              <span className="text-[10px]">Compiler is idle. Feed instructions to initialize.</span>
            </div>
          ) : (
            logs.map((l, idx) => {
              const colorClass = l.type === 'error' ? 'text-red-400 font-bold' : l.type === 'warning' ? 'text-amber-400 font-bold' : l.type === 'success' ? 'text-emerald-400 font-bold' : 'text-slate-300';
              return (
                <div key={idx} className="leading-tight transition-all duration-300 border-l border-slate-800 pl-1.5 ml-1">
                  <span className="text-slate-500 mr-1.5 font-bold">[{l.timestamp}]</span>
                  <span className={`${colorClass}`}>{l.message}</span>
                  {l.payload && (
                    <div className="text-[9px] text-slate-500 pl-4 mt-0.5 max-h-20 overflow-y-auto select-all">
                      {JSON.stringify(l.payload, null, 2)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
