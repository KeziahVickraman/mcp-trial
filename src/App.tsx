/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Server,
  Zap,
  Compass,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  MessageSquare,
  Bot,
  Sparkles,
  Send,
  Wrench,
  AlertTriangle,
  Clock,
  Radio,
  Bell,
  X,
  ShieldAlert
} from 'lucide-react';

interface ToolCall {
  name: string;
  args: Record<string, any>;
  failed: boolean;
}

interface UnavailableServer {
  address: string;
  reason: string;
}

interface DraftAlert {
  draft_id: string;
  subject: string;
  message: string;
  based_on: string;
}

interface AskResponse {
  answer: string;
  drafts?: DraftAlert[];
  tool_calls: ToolCall[];
  unavailable: UnavailableServer[];
  model: string;
  answered_at: string;
}

interface DraftActionState {
  state: 'pending' | 'sending' | 'approved' | 'discarded' | 'error';
  statusText?: string;
  httpStatus?: number;
}

export default function App() {
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [activeTab, setActiveTab] = useState<'ask' | 'overview' | 'test-carparks' | 'test-ev'>('ask');

  const PROD_MCP_URL = "https://parking-s-gtest.vercel.app/api/mcp";

  // Ask Panel state
  const [question, setQuestion] = useState('Find carparks near Marina Bay (lat: 1.293, lng: 103.857) with at least 5 available lots.');
  const [askLoading, setAskLoading] = useState(false);
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [draftStatuses, setDraftStatuses] = useState<Record<string, DraftActionState>>({});

  // Form states for test panels
  const [carparkLat, setCarparkLat] = useState('1.2930');
  const [carparkLng, setCarparkLng] = useState('103.8570');
  const [carparkRadius, setCarparkRadius] = useState('1000');
  const [carparkMinLots, setCarparkMinLots] = useState('5');
  const [carparkLoading, setCarparkLoading] = useState(false);
  const [carparkResult, setCarparkResult] = useState<string | null>(null);

  const [evLat, setEvLat] = useState('1.2930');
  const [evLng, setEvLng] = useState('103.8570');
  const [evRadius, setEvRadius] = useState('2000');
  const [evPlugType, setEvPlugType] = useState('Type 2');
  const [evLoading, setEvLoading] = useState(false);
  const [evResult, setEvResult] = useState<string | null>(null);

  const copyUrl = (targetUrl?: string) => {
    const url = typeof targetUrl === 'string' ? targetUrl : PROD_MCP_URL;
    navigator.clipboard.writeText(url);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  const handleAskAgent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;

    setAskLoading(true);
    setAskError(null);
    setAskResponse(null);
    setDraftStatuses({});

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question: question.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      setAskResponse(data);
    } catch (err: any) {
      setAskError(err.message || 'An error occurred while asking the agent.');
    } finally {
      setAskLoading(false);
    }
  };

  const handleApproveDraft = async (draft: DraftAlert) => {
    setDraftStatuses((prev) => ({
      ...prev,
      [draft.draft_id]: { state: 'sending' }
    }));

    try {
      const res = await fetch('/api/send-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          draft_id: draft.draft_id,
          subject: draft.subject,
          message: draft.message
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setDraftStatuses((prev) => ({
          ...prev,
          [draft.draft_id]: {
            state: 'error',
            statusText: data.error || `HTTP ${res.status}`,
            httpStatus: res.status
          }
        }));
      } else {
        const returnedStatus = data.status || res.status;
        setDraftStatuses((prev) => ({
          ...prev,
          [draft.draft_id]: {
            state: 'approved',
            statusText: `Webhook responded with HTTP ${returnedStatus}`,
            httpStatus: returnedStatus
          }
        }));
      }
    } catch (err: any) {
      setDraftStatuses((prev) => ({
        ...prev,
        [draft.draft_id]: {
          state: 'error',
          statusText: err.message || 'Failed to communicate with /api/send-alert'
        }
      }));
    }
  };

  const handleDiscardDraft = (draftId: string) => {
    setDraftStatuses((prev) => ({
      ...prev,
      [draftId]: {
        state: 'discarded',
        statusText: 'Draft discarded. Alert was not sent.'
      }
    }));
  };

  const handleTestCarparks = async () => {
    setCarparkLoading(true);
    setCarparkResult(null);
    try {
      const res = await fetch(`/api/carparks?lat=${carparkLat}&lng=${carparkLng}&radius_m=${carparkRadius}&min_lots=${carparkMinLots}`);
      const data = await res.json();
      setCarparkResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setCarparkResult(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setCarparkLoading(false);
    }
  };

  const handleTestEv = async () => {
    setEvLoading(true);
    setEvResult(null);
    try {
      const res = await fetch(`/api/ev-chargers?lat=${evLat}&lng=${evLng}&radius_m=${evRadius}&plug_type=${encodeURIComponent(evPlugType)}`);
      const data = await res.json();
      setEvResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setEvResult(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setEvLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/40">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-100 tracking-tight text-lg">g8-server</span>
              <span className="ml-2 text-xs bg-cyan-950 text-cyan-400 font-mono px-2 py-0.5 rounded border border-cyan-800/60">
                MCP v1.0.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => copyUrl()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition cursor-pointer"
            >
              {copiedEndpoint ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copiedEndpoint ? 'Copied' : 'Copy Production MCP URL'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/40 border border-slate-800 rounded-2xl p-6 sm:p-8 mb-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-3 py-1 rounded-full mb-3">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Streamable HTTP MCP Server Active
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                Singapore Transport &amp; Parking Tools
              </h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
                Other teams&apos; agents will call <code className="text-cyan-300 font-mono bg-slate-800 px-1.5 py-0.5 rounded">https://parking-s-gtest.vercel.app/api/mcp</code> through the Gemini SDK&apos;s <code className="text-slate-300 font-mono">mcpToTool</code>, which speaks MCP protocol 2025-11-25 over Streamable HTTP.
              </p>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl text-xs font-mono w-full sm:w-auto">
              <div className="text-slate-500 mb-1">Production MCP Endpoint</div>
              <div className="text-cyan-400 font-semibold truncate select-all">https://parking-s-gtest.vercel.app/api/mcp</div>
              <div className="text-slate-500 mt-2 mb-1">Protocol</div>
              <div className="text-emerald-400 font-semibold">2025-11-25 (Streamable HTTP)</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-6 border-b border-slate-800/80 pb-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ask')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                activeTab === 'ask'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Bot className="w-4 h-4" />
              Ask Agent (/api/ask)
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Registered Tools
            </button>
            <button
              onClick={() => setActiveTab('test-carparks')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                activeTab === 'test-carparks'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Test Carparks Route
            </button>
            <button
              onClick={() => setActiveTab('test-ev')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                activeTab === 'test-ev'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Test EV Chargers Route
            </button>
          </div>
        </div>

        {/* Tab 0: Ask Agent Panel */}
        {activeTab === 'ask' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-950/80 border border-blue-800/60 text-cyan-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Ask Gemini Transport Agent</h2>
                    <p className="text-xs text-slate-400">
                      Powered by <span className="font-mono text-cyan-300">gemini-3.8-flash</span> connected dynamically to MCP servers in <span className="font-mono text-slate-300">MCP_SERVERS</span>
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Streamable HTTP Client</span>
                </div>
              </div>

              {/* Question Form */}
              <form onSubmit={handleAskAgent} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="agent-question" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Visitor Question
                    </label>
                    <span className={`text-xs font-mono ${question.length > 500 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                      {question.length} / 500 characters
                    </span>
                  </div>
                  <textarea
                    id="agent-question"
                    rows={3}
                    maxLength={500}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about Singapore parking availability, EV chargers, or propose an alert..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition resize-none"
                  />
                </div>

                {/* Example query chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">Suggestions:</span>
                  <button
                    type="button"
                    onClick={() => setQuestion('Find carparks near Marina Bay (lat: 1.293, lng: 103.857) with at least 5 available lots.')}
                    className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/60 transition cursor-pointer"
                  >
                    Marina Bay Carparks
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestion('Draft an alert warning that Marina Bay carparks are low on lots.')}
                    className="text-xs bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-800/60 transition cursor-pointer"
                  >
                    ⚡ Propose Alert (HITL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestion('Are there any Type 2 EV charging stations near Orchard Road (lat: 1.304, lng: 103.831)?')}
                    className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/60 transition cursor-pointer"
                  >
                    Orchard EV Chargers
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={askLoading || !question.trim() || question.length > 500}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm shadow-lg shadow-cyan-950 transition cursor-pointer"
                  >
                    {askLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Querying MCP Agent...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Ask Agent</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Error display */}
              {askError && (
                <div className="mt-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Agent Error</div>
                    <div className="text-xs text-rose-300 mt-1">{askError}</div>
                  </div>
                </div>
              )}

              {/* Answer & Details */}
              {askResponse && (
                <div className="mt-8 space-y-6 pt-6 border-t border-slate-800">
                  {/* The Answer */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-cyan-400" />
                        <h3 className="font-semibold text-white text-base">Agent Answer</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-cyan-300">
                          {askResponse.model}
                        </span>
                        {askResponse.answered_at && (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            {new Date(askResponse.answered_at).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-5 text-slate-200 text-sm leading-relaxed shadow-inner">
                      {askResponse.answer ? (
                        <div className="whitespace-pre-wrap">{askResponse.answer}</div>
                      ) : (
                        <div className="text-slate-500 italic">No text answer returned.</div>
                      )}
                    </div>
                  </div>

                  {/* Proposed External Actions (Drafts) */}
                  {askResponse.drafts && askResponse.drafts.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-amber-400" />
                          <h4 className="font-semibold text-white text-sm">Proposed External Alerts (Human Approval Required)</h4>
                          <span className="text-xs bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full font-mono">
                            {askResponse.drafts.length} {askResponse.drafts.length === 1 ? 'draft' : 'drafts'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {askResponse.drafts.map((draft) => {
                          const status = draftStatuses[draft.draft_id] || { state: 'pending' };
                          return (
                            <div
                              key={draft.draft_id}
                              className="p-5 rounded-xl border border-amber-800/40 bg-slate-950 shadow-lg space-y-4"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-xs font-mono bg-amber-950/80 text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded">
                                    {draft.draft_id}
                                  </span>
                                  <span className="font-semibold text-white text-sm">
                                    {draft.subject}
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                                  Target: ALERT_WEBHOOK_URL
                                </span>
                              </div>

                              <div>
                                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                  Exact text to be sent:
                                </div>
                                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 font-mono whitespace-pre-wrap select-all">
                                  {draft.message}
                                </div>
                              </div>

                              {draft.based_on && (
                                <div className="text-xs text-slate-400 flex items-start gap-1.5">
                                  <span className="text-slate-500 font-semibold shrink-0">Based on:</span>
                                  <span className="italic text-slate-400">{draft.based_on}</span>
                                </div>
                              )}

                              {/* Action buttons and status feedback */}
                              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                                {status.state === 'pending' && (
                                  <>
                                    <div className="text-xs text-slate-400">
                                      Human authorization required before posting to external webhook.
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleDiscardDraft(draft.draft_id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5 text-slate-400" />
                                        Discard
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApproveDraft(draft)}
                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 transition cursor-pointer"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        Approve &amp; Send
                                      </button>
                                    </div>
                                  </>
                                )}

                                {status.state === 'sending' && (
                                  <div className="flex items-center gap-2 text-xs text-cyan-400 font-mono py-1">
                                    <div className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                                    <span>Posting alert to webhook (/api/send-alert)...</span>
                                  </div>
                                )}

                                {status.state === 'approved' && (
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-lg">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                      <span>Status: {status.statusText}</span>
                                    </div>
                                    <span className="text-[11px] font-mono text-emerald-500">Delivered</span>
                                  </div>
                                )}

                                {status.state === 'discarded' && (
                                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                                    <X className="w-4 h-4 text-slate-500 shrink-0" />
                                    <span>{status.statusText || 'Draft discarded. No external alert was sent.'}</span>
                                  </div>
                                )}

                                {status.state === 'error' && (
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                                    <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-950/60 border border-rose-800/60 px-3 py-1.5 rounded-lg">
                                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                      <span>Status: {status.statusText}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleDiscardDraft(draft.draft_id)}
                                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                                      >
                                        Dismiss
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApproveDraft(draft)}
                                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition cursor-pointer"
                                      >
                                        Retry
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Under it: Every tool called, in order, with its arguments */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-blue-400" />
                        <h4 className="font-semibold text-white text-sm">Tools Called by Agent</h4>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                          {askResponse.tool_calls.length}
                        </span>
                      </div>
                    </div>

                    {askResponse.tool_calls.length > 0 ? (
                      <div className="space-y-3">
                        {askResponse.tool_calls.map((call, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border text-xs font-mono transition ${
                              call.failed
                                ? 'bg-rose-950/20 border-rose-800/50 text-rose-200'
                                : 'bg-slate-950 border-slate-800/80 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-bold">{idx + 1}.</span>
                                <span className="font-semibold text-white">{call.name}</span>
                              </div>
                              {call.failed ? (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-medium">
                                  <AlertTriangle className="w-3 h-3" /> Failed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium">
                                  <Check className="w-3 h-3" /> Succeeded
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px] mb-1">Arguments:</div>
                            <pre className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-[11px] overflow-x-auto text-slate-300">
                              {JSON.stringify(call.args, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-950/50 border border-slate-800/60 p-4 rounded-xl text-xs text-slate-500 italic">
                        No external tools were invoked for this query.
                      </div>
                    )}
                  </div>

                  {/* Under it: Any unavailable servers in grey */}
                  {askResponse.unavailable && askResponse.unavailable.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Unavailable MCP Servers
                      </div>
                      <div className="space-y-2">
                        {askResponse.unavailable.map((srv, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900/30 border border-slate-800/70 p-3 rounded-lg text-xs font-mono text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                          >
                            <span className="truncate text-slate-400">{srv.address}</span>
                            <span className="text-slate-500 text-[11px] italic shrink-0">Reason: {srv.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Overview of Registered Tools */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tool 1 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700 transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/60">
                        <Compass className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-mono font-semibold text-white">g8_find_carparks</h3>
                        <div className="text-xs text-slate-400">Singapore LTA DataMall</div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">readOnly</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">openWorld</span>
                    </div>
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    Returns up to 10 carpark locations with current lot availability sorted by distance from the specified coordinates. Data is read directly from Singapore's Land Transport Authority (LTA) DataMall CarParkAvailabilityv2 API.
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input Parameters (Zod)</div>
                    <div className="bg-slate-950 p-3 rounded-lg text-xs font-mono space-y-1.5 text-slate-300 border border-slate-800/80">
                      <div><span className="text-cyan-400">lat</span>: number (required) - Latitude in SG</div>
                      <div><span className="text-cyan-400">lng</span>: number (required) - Longitude in SG</div>
                      <div><span className="text-cyan-400">radius_m</span>: number (optional) - Search radius</div>
                      <div><span className="text-cyan-400">min_lots</span>: number (optional) - Minimum lots</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Upstream: CarParkAvailabilityv2</span>
                  <span className="text-emerald-400 font-medium">Max 10 results</span>
                </div>
              </div>

              {/* Tool 2 */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700 transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-mono font-semibold text-white">g8_find_ev_chargers</h3>
                        <div className="text-xs text-slate-400">Singapore LTA DataMall</div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">readOnly</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">openWorld</span>
                    </div>
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    Returns up to 10 electric vehicle charging station locations sorted by distance without nested connector details. Data is read directly from Singapore's Land Transport Authority (LTA) DataMall EV Charging API.
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input Parameters (Zod)</div>
                    <div className="bg-slate-950 p-3 rounded-lg text-xs font-mono space-y-1.5 text-slate-300 border border-slate-800/80">
                      <div><span className="text-emerald-400">lat</span>: number (required) - Latitude in SG</div>
                      <div><span className="text-emerald-400">lng</span>: number (required) - Longitude in SG</div>
                      <div><span className="text-emerald-400">radius_m</span>: number (optional) - Search radius</div>
                      <div><span className="text-emerald-400">plug_type</span>: string (optional) - Filter by plug</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Upstream: EVCBatch</span>
                  <span className="text-emerald-400 font-medium">Max 10 results</span>
                </div>
              </div>

              {/* Tool 3: g8_draft_alert */}
              <div className="bg-slate-900/60 border border-amber-800/40 rounded-xl p-6 flex flex-col justify-between hover:border-amber-700/60 transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-amber-950 text-amber-400 border border-amber-800/60">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-mono font-semibold text-white">g8_draft_alert</h3>
                        <div className="text-xs text-amber-300/80">Human-in-the-Loop</div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">readOnly</span>
                      <span className="text-[10px] bg-amber-950 text-amber-300 font-mono px-2 py-0.5 rounded border border-amber-800/60">HITL</span>
                    </div>
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    Drafts an alert notification for external distribution based on transport findings. Sends nothing. Returns <code className="text-amber-300">{`{ draft_id, subject, message, based_on }`}</code> for human authorization via <code className="text-slate-200">/api/send-alert</code>.
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input Parameters (Zod)</div>
                    <div className="bg-slate-950 p-3 rounded-lg text-xs font-mono space-y-1.5 text-slate-300 border border-slate-800/80">
                      <div><span className="text-amber-400">subject</span>: string (required) - Alert subject</div>
                      <div><span className="text-amber-400">message</span>: string (required) - Content to send</div>
                      <div><span className="text-amber-400">based_on</span>: string (required) - Data basis</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Annotation: readOnlyHint</span>
                  <span className="text-amber-400 font-medium">Sends nothing</span>
                </div>
              </div>
            </div>

            {/* Quick Agent Usage Guide */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Integration for AI Agents
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Other teams&apos; agents will call <code className="text-cyan-300 font-mono">https://parking-s-gtest.vercel.app/api/mcp</code> through the Gemini SDK&apos;s <code className="text-slate-300 font-mono">mcpToTool</code> over Streamable HTTP:
              </p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                <pre>{`// Using Gemini SDK's mcpToTool:
import { mcpToTool } from "@google/genai";

const tools = await mcpToTool({
  transport: {
    type: "streamableHttp",
    url: "https://parking-s-gtest.vercel.app/api/mcp",
  }
});

// Pass tools directly to generateContent / agent sessions`}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Test Carparks */}
        {activeTab === 'test-carparks' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-400" />
              Test Carpark Query (/api/carparks)
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Invokes the shared <code className="text-cyan-300 font-mono">lib/lta.js</code> function with real parameters.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Latitude</label>
                <input
                  type="text"
                  value={carparkLat}
                  onChange={(e) => setCarparkLat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Longitude</label>
                <input
                  type="text"
                  value={carparkLng}
                  onChange={(e) => setCarparkLng(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Radius (meters)</label>
                <input
                  type="text"
                  value={carparkRadius}
                  onChange={(e) => setCarparkRadius(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Min Lots</label>
                <input
                  type="text"
                  value={carparkMinLots}
                  onChange={(e) => setCarparkMinLots(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              onClick={handleTestCarparks}
              disabled={carparkLoading}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition cursor-pointer"
            >
              {carparkLoading ? 'Fetching from LTA DataMall...' : 'Run Carpark Query'}
            </button>

            {carparkResult && (
              <div className="mt-6">
                <div className="text-xs font-semibold text-slate-400 mb-2">Response:</div>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-96">
                  {carparkResult}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Test EV Chargers */}
        {activeTab === 'test-ev' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Test EV Chargers Query (/api/ev-chargers)
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Invokes the shared <code className="text-emerald-300 font-mono">lib/lta.js</code> function with real parameters.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Latitude</label>
                <input
                  type="text"
                  value={evLat}
                  onChange={(e) => setEvLat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Longitude</label>
                <input
                  type="text"
                  value={evLng}
                  onChange={(e) => setEvLng(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Radius (meters)</label>
                <input
                  type="text"
                  value={evRadius}
                  onChange={(e) => setEvRadius(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Plug Type</label>
                <input
                  type="text"
                  value={evPlugType}
                  onChange={(e) => setEvPlugType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              onClick={handleTestEv}
              disabled={evLoading}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm transition cursor-pointer"
            >
              {evLoading ? 'Fetching from LTA DataMall...' : 'Run EV Query'}
            </button>

            {evResult && (
              <div className="mt-6">
                <div className="text-xs font-semibold text-slate-400 mb-2">Response:</div>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-96">
                  {evResult}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
