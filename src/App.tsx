/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Server, Database, Zap, Compass, CheckCircle2, AlertCircle, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

export default function App() {
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'test-carparks' | 'test-ev'>('overview');

  const PROD_MCP_URL = "https://parking-s-gtest.vercel.app/api/mcp";

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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition"
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
          <div className="flex gap-2 mt-6 border-b border-slate-800/80 pb-3">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'overview'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Registered Tools
            </button>
            <button
              onClick={() => setActiveTab('test-carparks')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'test-carparks'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Test Carparks Route
            </button>
            <button
              onClick={() => setActiveTab('test-ev')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'test-ev'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Test EV Chargers Route
            </button>
          </div>
        </div>

        {/* Tab 1: Overview of Registered Tools */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    Returns up to 10 carpark locations with current lot availability sorted by distance from the specified coordinates. Data is read directly from Singapore's Land Transport Authority (LTA) DataMall CarParkAvailabilityv2 API. Use this tool when a user needs to find nearby parking spaces or check real-time lot availability around a location in Singapore. This tool does not provide parking fee calculations or reserved lot booking capabilities.
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input Parameters (Zod)</div>
                    <div className="bg-slate-950 p-3 rounded-lg text-xs font-mono space-y-1.5 text-slate-300 border border-slate-800/80">
                      <div><span className="text-cyan-400">lat</span>: number (required) - Latitude in SG</div>
                      <div><span className="text-cyan-400">lng</span>: number (required) - Longitude in SG</div>
                      <div><span className="text-cyan-400">radius_m</span>: number (optional) - Search radius in meters</div>
                      <div><span className="text-cyan-400">min_lots</span>: number (optional) - Minimum lots available</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Upstream: CarParkAvailabilityv2 ($skip)</span>
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
                    Returns up to 10 electric vehicle charging station locations sorted by distance without nested connector details. Data is read directly from Singapore's Land Transport Authority (LTA) DataMall EV Charging API. Use this tool when a user wants to find nearby EV charging stations or locate charging points compatible with a specific plug type in Singapore. This tool does not provide real-time session initiation, charging payment processing, or live connector occupancy states.
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Input Parameters (Zod)</div>
                    <div className="bg-slate-950 p-3 rounded-lg text-xs font-mono space-y-1.5 text-slate-300 border border-slate-800/80">
                      <div><span className="text-emerald-400">lat</span>: number (required) - Latitude in SG</div>
                      <div><span className="text-emerald-400">lng</span>: number (required) - Longitude in SG</div>
                      <div><span className="text-emerald-400">radius_m</span>: number (optional) - Search radius in meters</div>
                      <div><span className="text-emerald-400">plug_type</span>: string (optional) - Type 2, CCS2, etc.</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Upstream: EVCBatch (stripped nested details)</span>
                  <span className="text-emerald-400 font-medium">Max 10 results</span>
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
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition"
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
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm transition"
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
