/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Car,
  Zap,
  Bot,
  Server,
  Compass,
  Navigation,
  MapPin,
  Clock,
  Sparkles,
  Send,
  Wrench,
  AlertTriangle,
  Radio,
  Bell,
  X,
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  SlidersHorizontal,
  RefreshCw,
  LocateFixed,
  ChevronRight
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

interface CarparkItem {
  carpark_id: string;
  area?: string;
  development?: string;
  location?: string;
  available_lots: number;
  lot_type?: string;
  agency?: string;
  distance_m?: number;
  latitude?: number;
  longitude?: number;
}

interface EvChargerItem {
  name?: string;
  Name?: string;
  title?: string;
  description?: string;
  Description?: string;
  address?: string;
  Address?: string;
  operator?: string;
  Operator?: string;
  distance_m?: number;
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

const LOCATION_PRESETS = [
  { name: 'Marina Bay', lat: '1.2930', lng: '103.8570' },
  { name: 'Orchard Road', lat: '1.3040', lng: '103.8310' },
  { name: 'Raffles Place', lat: '1.2840', lng: '103.8510' },
  { name: 'Bugis Junction', lat: '1.3005', lng: '103.8550' },
  { name: 'Jurong East', lat: '1.3331', lng: '103.7423' },
  { name: 'Changi Airport', lat: '1.3644', lng: '103.9915' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'carparks' | 'ev' | 'ask' | 'mcp'>('carparks');
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const PROD_MCP_URL = "https://mcp-trial-ebon.vercel.app/api.mcp";

  // Coordinates & Filter State
  const [selectedPreset, setSelectedPreset] = useState<string>('Marina Bay');
  const [lat, setLat] = useState('1.2930');
  const [lng, setLng] = useState('103.8570');
  const [radiusM, setRadiusM] = useState('1500');
  const [minLots, setMinLots] = useState('0');
  const [plugType, setPlugType] = useState('');

  // Live Data State
  const [carparks, setCarparks] = useState<CarparkItem[]>([]);
  const [carparkLoading, setCarparkLoading] = useState(false);
  const [carparkError, setCarparkError] = useState<string | null>(null);
  const [carparkFetchedAt, setCarparkFetchedAt] = useState<string | null>(null);

  const [evChargers, setEvChargers] = useState<EvChargerItem[]>([]);
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);
  const [evFetchedAt, setEvFetchedAt] = useState<string | null>(null);

  // Ask Agent State
  const [question, setQuestion] = useState('Which carparks near Marina Bay have the most available lots right now?');
  const [askLoading, setAskLoading] = useState(false);
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [draftStatuses, setDraftStatuses] = useState<Record<string, DraftActionState>>({});

  // Auto-fetch carparks on mount
  useEffect(() => {
    fetchLiveCarparks(lat, lng, radiusM, minLots);
  }, []);

  const copyUrl = (targetUrl?: string) => {
    const url = typeof targetUrl === 'string' ? targetUrl : PROD_MCP_URL;
    navigator.clipboard.writeText(url);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  const handleApplyPreset = (preset: typeof LOCATION_PRESETS[0]) => {
    setSelectedPreset(preset.name);
    setLat(preset.lat);
    setLng(preset.lng);
    if (activeTab === 'carparks') {
      fetchLiveCarparks(preset.lat, preset.lng, radiusM, minLots);
    } else if (activeTab === 'ev') {
      fetchLiveEv(preset.lat, preset.lng, radiusM, plugType);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const curLat = pos.coords.latitude.toFixed(4);
        const curLng = pos.coords.longitude.toFixed(4);
        setSelectedPreset('My Location');
        setLat(curLat);
        setLng(curLng);
        if (activeTab === 'carparks') {
          fetchLiveCarparks(curLat, curLng, radiusM, minLots);
        } else if (activeTab === 'ev') {
          fetchLiveEv(curLat, curLng, radiusM, plugType);
        }
      },
      (err) => {
        console.warn('Geolocation warning:', err.message);
        // Default graceful fallback to Marina Bay
        handleApplyPreset(LOCATION_PRESETS[0]);
      },
      { timeout: 8000 }
    );
  };

  const fetchLiveCarparks = async (queryLat = lat, queryLng = lng, queryRad = radiusM, queryMin = minLots) => {
    setCarparkLoading(true);
    setCarparkError(null);
    try {
      const url = `/api/carparks?lat=${queryLat}&lng=${queryLng}&radius_m=${queryRad}&min_lots=${queryMin}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Upstream returned status ${res.status}`);
      }
      const data = await res.json();
      setCarparks(data.items || data.carparks || []);
      setCarparkFetchedAt(data.fetched_at || new Date().toISOString());
    } catch (err: any) {
      setCarparkError(err.message || 'Unable to fetch carpark availability from LTA DataMall');
    } finally {
      setCarparkLoading(false);
    }
  };

  const fetchLiveEv = async (queryLat = lat, queryLng = lng, queryRad = radiusM, queryPlug = plugType) => {
    setEvLoading(true);
    setEvError(null);
    try {
      const url = `/api/ev-chargers?lat=${queryLat}&lng=${queryLng}&radius_m=${queryRad}${
        queryPlug ? `&plug_type=${encodeURIComponent(queryPlug)}` : ''
      }`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Upstream returned status ${res.status}`);
      }
      const data = await res.json();
      setEvChargers(data.items || data.locations || []);
      setEvFetchedAt(data.fetched_at || new Date().toISOString());
    } catch (err: any) {
      setEvError(err.message || 'Unable to fetch EV chargers from LTA DataMall');
    } finally {
      setEvLoading(false);
    }
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
            statusText: `Delivered (HTTP ${returnedStatus})`,
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

  const handleDraftAlertForCarpark = (cp: CarparkItem) => {
    const prompt = `Draft an alert noting that ${cp.development || cp.carpark_id} currently has ${
      cp.available_lots
    } available parking lots near ${selectedPreset}.`;
    setQuestion(prompt);
    setActiveTab('ask');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">SG Mobility Hub</span>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live LTA Data
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Real-Time Carpark Availability, EV Stations &amp; Gemini Agent
              </p>
            </div>
          </div>

          {/* Right Action: Copy MCP Endpoint */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyUrl()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-medium border border-slate-200 transition cursor-pointer"
              title="Copy Streamable HTTP MCP server URL for external agents"
            >
              {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span className="hidden sm:inline">{copiedEndpoint ? 'Copied URL' : 'Copy MCP Server URL'}</span>
              <span className="sm:hidden">MCP URL</span>
            </button>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 border-t border-slate-100 flex gap-1 sm:gap-2 overflow-x-auto py-2">
          <button
            onClick={() => {
              setActiveTab('carparks');
              if (carparks.length === 0) fetchLiveCarparks();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === 'carparks'
                ? 'bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Carpark Availability</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('ev');
              if (evChargers.length === 0) fetchLiveEv();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === 'ev'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>EV Charging Stations</span>
          </button>

          <button
            onClick={() => setActiveTab('ask')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === 'ask'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Ask Gemini Agent &amp; Alerts</span>
          </button>

          <button
            onClick={() => setActiveTab('mcp')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === 'mcp'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>MCP Server API</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* =========================================================================
            TAB 1: LIVE CARPARKS FINDER
           ========================================================================= */}
        {activeTab === 'carparks' && (
          <div className="space-y-6">
            {/* Search & Location Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Explore Real-Time Carpark Availability</h2>
                  <p className="text-xs text-slate-500">
                    Live telemetry directly from Singapore LTA DataMall, sorted by distance from your search center.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUseCurrentLocation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition cursor-pointer"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-blue-600" />
                    <span>My Location</span>
                  </button>
                  <button
                    onClick={() => fetchLiveCarparks(lat, lng, radiusM, minLots)}
                    disabled={carparkLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${carparkLoading ? 'animate-spin' : ''}`} />
                    <span>{carparkLoading ? 'Updating...' : 'Refresh Feed'}</span>
                  </button>
                </div>
              </div>

              {/* Location Preset Chips */}
              <div>
                <span className="text-xs text-slate-400 font-medium mr-2">Quick Locations:</span>
                <div className="inline-flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                  {LOCATION_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handleApplyPreset(p)}
                      className={`text-xs px-2.5 py-1 rounded-md transition cursor-pointer ${
                        selectedPreset === p.name
                          ? 'bg-blue-600 text-white font-medium shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/70'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Coordinates & Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Latitude</label>
                  <input
                    type="text"
                    value={lat}
                    onChange={(e) => {
                      setLat(e.target.value);
                      setSelectedPreset('Custom');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Longitude</label>
                  <input
                    type="text"
                    value={lng}
                    onChange={(e) => {
                      setLng(e.target.value);
                      setSelectedPreset('Custom');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Search Radius</label>
                  <select
                    value={radiusM}
                    onChange={(e) => {
                      setRadiusM(e.target.value);
                      fetchLiveCarparks(lat, lng, e.target.value, minLots);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="500">500 meters</option>
                    <option value="1000">1.0 km</option>
                    <option value="1500">1.5 km</option>
                    <option value="3000">3.0 km</option>
                    <option value="5000">5.0 km</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Min Available Lots</label>
                  <select
                    value={minLots}
                    onChange={(e) => {
                      setMinLots(e.target.value);
                      fetchLiveCarparks(lat, lng, radiusM, e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="0">All Available (0+)</option>
                    <option value="5">At least 5 lots</option>
                    <option value="10">At least 10 lots</option>
                    <option value="25">At least 25 lots</option>
                    <option value="50">At least 50 lots</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {carparkError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <div className="font-semibold">Unable to fetch carpark data</div>
                  <div className="text-xs text-rose-600 mt-0.5">{carparkError}</div>
                </div>
              </div>
            )}

            {/* Status & Summary bar */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <div>
                Showing <span className="font-semibold text-slate-900">{carparks.length}</span> nearby carparks for{' '}
                <span className="font-semibold text-slate-900">{selectedPreset}</span> (within {parseInt(radiusM) >= 1000 ? `${parseInt(radiusM) / 1000}km` : `${radiusM}m`})
              </div>
              {carparkFetchedAt && (
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Updated {new Date(carparkFetchedAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            {/* Carparks Card Grid */}
            {carparkLoading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-600 font-medium">Querying Singapore LTA DataMall...</p>
                <p className="text-xs text-slate-400 mt-1">Scanning CarParkAvailabilityv2 records</p>
              </div>
            ) : carparks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {carparks.map((cp) => {
                  const isLow = cp.available_lots < 5;
                  const isMedium = cp.available_lots >= 5 && cp.available_lots <= 20;

                  return (
                    <div
                      key={cp.carpark_id}
                      className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: Title & Agency */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1">
                            {cp.development || cp.carpark_id}
                          </h3>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                            {cp.agency || 'LTA'}
                          </span>
                        </div>

                        {/* Location / Area info */}
                        <div className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{cp.area || 'Central Singapore'}</span>
                          {cp.distance_m != null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-slate-700">
                                {cp.distance_m < 1000 ? `${cp.distance_m} m away` : `${(cp.distance_m / 1000).toFixed(1)} km away`}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Available Lots Meter */}
                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 mb-4 flex items-center justify-between">
                          <div>
                            <div className="text-xs text-slate-500 font-medium">Available Lots</div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span
                                className={`text-2xl font-extrabold ${
                                  isLow ? 'text-rose-600' : isMedium ? 'text-amber-600' : 'text-emerald-600'
                                }`}
                              >
                                {cp.available_lots}
                              </span>
                              <span className="text-xs text-slate-500">lots</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-block ${
                                isLow
                                  ? 'bg-rose-100 text-rose-800'
                                  : isMedium
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isLow ? 'Nearly Full' : isMedium ? 'Filling Fast' : 'Lots Available'}
                            </span>
                            <div className="text-[11px] text-slate-400 mt-1">Vehicle Type: {cp.lot_type || 'Car'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {cp.latitude && cp.longitude ? (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${cp.latitude},${cp.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Directions</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">ID: {cp.carpark_id}</span>
                        )}

                        <button
                          onClick={() => handleDraftAlertForCarpark(cp)}
                          className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                          title="Ask the Gemini Agent to draft an alert for this carpark"
                        >
                          <Bell className="w-3 h-3 text-amber-600" />
                          <span>Draft Alert</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <Car className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-800 text-sm">No carparks found in this radius</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Try expanding your search radius or lowering the minimum available lot requirement.
                </p>
                <button
                  onClick={() => {
                    setRadiusM('3000');
                    setMinLots('0');
                    fetchLiveCarparks(lat, lng, '3000', '0');
                  }}
                  className="mt-4 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition cursor-pointer"
                >
                  Expand Radius to 3km
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: LIVE EV CHARGING STATIONS
           ========================================================================= */}
        {activeTab === 'ev' && (
          <div className="space-y-6">
            {/* Search & Location Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Electric Vehicle Charging Network</h2>
                  <p className="text-xs text-slate-500">
                    Live Singapore charging station points from LTA DataMall with plug-type filtering.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUseCurrentLocation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition cursor-pointer"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-emerald-600" />
                    <span>My Location</span>
                  </button>
                  <button
                    onClick={() => fetchLiveEv(lat, lng, radiusM, plugType)}
                    disabled={evLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${evLoading ? 'animate-spin' : ''}`} />
                    <span>{evLoading ? 'Updating...' : 'Refresh EV Feed'}</span>
                  </button>
                </div>
              </div>

              {/* Location Preset Chips */}
              <div>
                <span className="text-xs text-slate-400 font-medium mr-2">Quick Locations:</span>
                <div className="inline-flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                  {LOCATION_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handleApplyPreset(p)}
                      className={`text-xs px-2.5 py-1 rounded-md transition cursor-pointer ${
                        selectedPreset === p.name
                          ? 'bg-emerald-600 text-white font-medium shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/70'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plug Type & Filter row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Latitude</label>
                  <input
                    type="text"
                    value={lat}
                    onChange={(e) => {
                      setLat(e.target.value);
                      setSelectedPreset('Custom');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Longitude</label>
                  <input
                    type="text"
                    value={lng}
                    onChange={(e) => {
                      setLng(e.target.value);
                      setSelectedPreset('Custom');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Search Radius</label>
                  <select
                    value={radiusM}
                    onChange={(e) => {
                      setRadiusM(e.target.value);
                      fetchLiveEv(lat, lng, e.target.value, plugType);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="1000">1.0 km</option>
                    <option value="2000">2.0 km</option>
                    <option value="3000">3.0 km</option>
                    <option value="5000">5.0 km</option>
                    <option value="10000">10.0 km</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Plug / Connector Type</label>
                  <select
                    value={plugType}
                    onChange={(e) => {
                      setPlugType(e.target.value);
                      fetchLiveEv(lat, lng, radiusM, e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">All Plug Types</option>
                    <option value="Type 2">Type 2 (AC)</option>
                    <option value="CCS2">CCS2 (DC Fast)</option>
                    <option value="CHAdeMO">CHAdeMO</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {evError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <div className="font-semibold">Unable to fetch EV charging stations</div>
                  <div className="text-xs text-rose-600 mt-0.5">{evError}</div>
                </div>
              </div>
            )}

            {/* Summary bar */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <div>
                Found <span className="font-semibold text-slate-900">{evChargers.length}</span> EV stations near{' '}
                <span className="font-semibold text-slate-900">{selectedPreset}</span>
                {plugType && (
                  <span>
                    {' '}
                    filtering for <span className="font-semibold text-emerald-700">{plugType}</span>
                  </span>
                )}
              </div>
              {evFetchedAt && (
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Updated {new Date(evFetchedAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            {/* EV Stations Grid */}
            {evLoading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-600 font-medium">Scanning Singapore EV Charging Network...</p>
                <p className="text-xs text-slate-400 mt-1">Retrieving LTA EVCBatch feeds</p>
              </div>
            ) : evChargers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {evChargers.map((st, idx) => {
                  const title = st.name || st.Name || st.title || st.description || st.Description || `EV Station #${idx + 1}`;
                  const address = st.address || st.Address || st.Location || 'Singapore';
                  const operator = st.operator || st.Operator || 'Public Charging Network';

                  return (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1">{title}</h3>
                          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                            EV
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{address}</span>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1.5 mb-4">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Operator:</span>
                            <span className="font-medium text-slate-900">{operator}</span>
                          </div>
                          {st.distance_m != null && (
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Distance:</span>
                              <span className="font-bold text-emerald-700">
                                {st.distance_m < 1000
                                  ? `${st.distance_m} m away`
                                  : `${(st.distance_m / 1000).toFixed(1)} km away`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        {st.latitude && st.longitude ? (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${st.latitude},${st.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Navigate</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">Station Active</span>
                        )}

                        <span className="text-[11px] text-slate-500 font-mono">
                          {st.latitude?.toFixed(3)}, {st.longitude?.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-800 text-sm">No EV chargers found in this search radius</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Try expanding the search radius or selecting &quot;All Plug Types&quot;.
                </p>
                <button
                  onClick={() => {
                    setRadiusM('5000');
                    setPlugType('');
                    fetchLiveEv(lat, lng, '5000', '');
                  }}
                  className="mt-4 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition cursor-pointer"
                >
                  Reset Filters (5km / All Plugs)
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: ASK GEMINI AGENT & ALERTS
           ========================================================================= */}
        {activeTab === 'ask' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Gemini Transport Mobility Assistant</h2>
                    <p className="text-xs text-slate-500">
                      Grounded in real-time MCP tools via <span className="font-mono text-indigo-700 font-semibold">gemini-3.8-flash</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span>Streamable HTTP Client Connected</span>
                </div>
              </div>

              {/* Question Form */}
              <form onSubmit={handleAskAgent} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="user-question" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Ask a Question or Request an Action
                    </label>
                    <span className={`text-xs font-mono ${question.length > 500 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                      {question.length} / 500
                    </span>
                  </div>
                  <textarea
                    id="user-question"
                    rows={3}
                    maxLength={500}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about carparks, EV charging stations, or ask the agent to draft an alert for low lots..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
                  />
                </div>

                {/* Suggestions Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Try asking:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestion('Find carparks near Marina Bay (lat: 1.293, lng: 103.857) with at least 5 available lots.')
                    }
                    className="text-xs bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition cursor-pointer"
                  >
                    Marina Bay Availability
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestion('Draft an alert warning that Marina Bay carparks are low on lots.')
                    }
                    className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md border border-amber-200 transition cursor-pointer font-medium"
                  >
                    ⚡ Propose External Alert (HITL)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestion('Are there any Type 2 EV charging stations near Orchard Road (lat: 1.304, lng: 103.831)?')
                    }
                    className="text-xs bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition cursor-pointer"
                  >
                    Orchard EV Stations
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={askLoading || !question.trim() || question.length > 500}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-xs transition cursor-pointer"
                  >
                    {askLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Querying MCP Agent...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit to Agent</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Error Alert */}
              {askError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Agent Query Error</div>
                    <div className="text-xs text-rose-700 mt-1">{askError}</div>
                  </div>
                </div>
              )}

              {/* Response Section */}
              {askResponse && (
                <div className="mt-8 space-y-6 pt-6 border-t border-slate-200">
                  {/* Agent Answer */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-600" />
                        <h3 className="font-semibold text-slate-900 text-base">Agent Response</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                          {askResponse.model}
                        </span>
                        {askResponse.answered_at && (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(askResponse.answered_at).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-slate-800 text-sm leading-relaxed">
                      {askResponse.answer ? (
                        <div className="whitespace-pre-wrap">{askResponse.answer}</div>
                      ) : (
                        <div className="text-slate-400 italic">No textual answer returned.</div>
                      )}
                    </div>
                  </div>

                  {/* Proposed External Action (Human-in-the-Loop Drafts) */}
                  {askResponse.drafts && askResponse.drafts.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-600" />
                        <h4 className="font-bold text-slate-900 text-sm">
                          Proposed External Actions (Human Authorization Required)
                        </h4>
                        <span className="text-xs bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 rounded-full">
                          {askResponse.drafts.length} Action{askResponse.drafts.length > 1 ? 's' : ''}
                        </span>
                      </div>

                      {askResponse.drafts.map((draft) => {
                        const status = draftStatuses[draft.draft_id] || { state: 'pending' };
                        return (
                          <div
                            key={draft.draft_id}
                            className="bg-amber-50/50 border border-amber-300 rounded-xl p-5 shadow-xs space-y-4"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded">
                                  {draft.draft_id}
                                </span>
                                <span className="font-bold text-slate-900 text-sm">{draft.subject}</span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                                Route: POST /api/send-alert
                              </span>
                            </div>

                            <div>
                              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                                Exact Text to be Sent to ALERT_WEBHOOK_URL:
                              </div>
                              <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs sm:text-sm text-slate-800 font-mono whitespace-pre-wrap select-all shadow-inner">
                                {draft.message}
                              </div>
                            </div>

                            {draft.based_on && (
                              <div className="text-xs text-slate-600 flex items-start gap-1">
                                <span className="font-semibold text-slate-700 shrink-0">Basis:</span>
                                <span className="italic">{draft.based_on}</span>
                              </div>
                            )}

                            {/* Human Action Controls */}
                            <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-3">
                              {status.state === 'pending' && (
                                <>
                                  <div className="text-xs text-slate-600">
                                    The agent proposed this alert. Choose whether to broadcast to the team.
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDiscardDraft(draft.draft_id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-300 transition cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Discard</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveDraft(draft)}
                                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Approve &amp; Send</span>
                                    </button>
                                  </div>
                                </>
                              )}

                              {status.state === 'sending' && (
                                <div className="flex items-center gap-2 text-xs text-indigo-700 font-medium py-1">
                                  <div className="w-3.5 h-3.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                                  <span>Posting to external webhook (/api/send-alert)...</span>
                                </div>
                              )}

                              {status.state === 'approved' && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg w-full">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                  <span>Action Approved &amp; Sent: {status.statusText}</span>
                                </div>
                              )}

                              {status.state === 'discarded' && (
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg w-full">
                                  <X className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span>{status.statusText}</span>
                                </div>
                              )}

                              {status.state === 'error' && (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                                  <div className="flex items-center gap-2 text-xs text-rose-800 bg-rose-100 border border-rose-300 px-3 py-1.5 rounded-lg">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>Failed to Deliver: {status.statusText}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDiscardDraft(draft.draft_id)}
                                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium cursor-pointer"
                                    >
                                      Dismiss
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveDraft(draft)}
                                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 cursor-pointer"
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
                  )}

                  {/* Tools Executed Timeline */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-slate-500" />
                        <h4 className="font-semibold text-slate-900 text-sm">Tools Executed in this Turn</h4>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                          {askResponse.tool_calls.length}
                        </span>
                      </div>
                    </div>

                    {askResponse.tool_calls.length > 0 ? (
                      <div className="space-y-2.5">
                        {askResponse.tool_calls.map((call, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border text-xs font-mono transition ${
                              call.failed
                                ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                                : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 font-bold">{idx + 1}.</span>
                                <span className="font-bold text-slate-900">{call.name}</span>
                              </div>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  call.failed ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {call.failed ? 'Failed' : 'Executed'}
                              </span>
                            </div>
                            <pre className="bg-slate-50 p-2 rounded border border-slate-100 text-[11px] overflow-x-auto text-slate-600 mt-1">
                              {JSON.stringify(call.args, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-400 italic">
                        No external tools were invoked for this query.
                      </div>
                    )}
                  </div>

                  {/* Unavailable Servers in Grey */}
                  {askResponse.unavailable && askResponse.unavailable.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Unreachable MCP Servers
                      </div>
                      <div className="space-y-1.5">
                        {askResponse.unavailable.map((srv, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-100 border border-slate-200 p-2.5 rounded-lg text-xs font-mono text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                          >
                            <span className="truncate">{srv.address}</span>
                            <span className="text-slate-400 text-[11px] italic shrink-0">Reason: {srv.reason}</span>
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

        {/* =========================================================================
            TAB 4: MCP SERVER API & DEVELOPER HUB
           ========================================================================= */}
        {activeTab === 'mcp' && (
          <div className="space-y-6">
            {/* Server Endpoint Banner */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Production MCP Endpoint Active
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Streamable HTTP Model Context Protocol</h2>
                  <p className="text-xs text-slate-500 max-w-2xl mt-1">
                    Connect any agent (Gemini SDK, Claude, Cursor, LangChain) directly to real-time Singapore LTA DataMall tools.
                  </p>
                </div>

                <button
                  onClick={() => copyUrl()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
                >
                  {copiedEndpoint ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
                  <span>{copiedEndpoint ? 'Copied' : 'Copy Endpoint URL'}</span>
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-semibold text-slate-800 select-all">{PROD_MCP_URL}</span>
                <span className="text-slate-500 text-[11px]">Protocol: 2025-11-25 (Streamable HTTP)</span>
              </div>
            </div>

            {/* Registered Tools Grid */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                Tools Published by this MCP Server
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tool 1 */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Car className="w-4 h-4" />
                        </div>
                        <h4 className="font-mono font-bold text-slate-900 text-sm">g8_find_carparks</h4>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded">readOnly</span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      Returns up to 10 carpark locations with real-time lot availability sorted by distance from coordinates.
                    </p>

                    <div className="bg-slate-50 p-2.5 rounded-lg text-[11px] font-mono text-slate-700 space-y-1 mb-3">
                      <div>lat: number (required)</div>
                      <div>lng: number (required)</div>
                      <div>radius_m: number (optional)</div>
                      <div>min_lots: number (optional)</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    Source: LTA CarParkAvailabilityv2
                  </div>
                </div>

                {/* Tool 2 */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Zap className="w-4 h-4" />
                        </div>
                        <h4 className="font-mono font-bold text-slate-900 text-sm">g8_find_ev_chargers</h4>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded">readOnly</span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      Returns up to 10 EV charging locations sorted by distance with plug-type filtering capability.
                    </p>

                    <div className="bg-slate-50 p-2.5 rounded-lg text-[11px] font-mono text-slate-700 space-y-1 mb-3">
                      <div>lat: number (required)</div>
                      <div>lng: number (required)</div>
                      <div>radius_m: number (optional)</div>
                      <div>plug_type: string (optional)</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    Source: LTA EVCBatch
                  </div>
                </div>

                {/* Tool 3 */}
                <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                          <Bell className="w-4 h-4" />
                        </div>
                        <h4 className="font-mono font-bold text-slate-900 text-sm">g8_draft_alert</h4>
                      </div>
                      <span className="text-[10px] bg-amber-100 text-amber-900 font-mono px-1.5 py-0.5 rounded">HITL</span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      Drafts an alert for external distribution. Sends nothing. Requires human approval before delivery.
                    </p>

                    <div className="bg-slate-50 p-2.5 rounded-lg text-[11px] font-mono text-slate-700 space-y-1 mb-3">
                      <div>subject: string (required)</div>
                      <div>message: string (required)</div>
                      <div>based_on: string (required)</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    Execution: Route /api/send-alert
                  </div>
                </div>
              </div>
            </div>

            {/* SDK Integration Code */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Agent Integration Example</h3>
              <p className="text-xs text-slate-500 mb-4">
                Use the Google GenAI SDK to bind this server directly as tools for Gemini models:
              </p>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
{`import { GoogleGenAI, mcpToTool } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-transport-agent", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL("${PROD_MCP_URL}")));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: "gemini-3.8-flash",
  contents: "Find available carparks near Marina Bay",
  config: {
    tools: [mcpToTool(client)],
    automaticFunctionCalling: { maximumRemoteCalls: 6 }
  }
});

console.log(response.text);
await client.close();`}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>Singapore Land Transport Authority DataMall · Real-time Open Data Feed</div>
          <div className="font-mono text-slate-400">Streamable HTTP MCP Protocol 2025-11-25</div>
        </div>
      </footer>
    </div>
  );
}
