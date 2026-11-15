import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle, Clock,
  Train as TrainIcon, RefreshCw, Radio, Layers, ShieldCheck,
  Zap, Info, BarChart3, ArrowRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import {
  api,
  type TrafficOverviewResponse,
  type TrafficArrivalsResponse,
  type TrafficDeparturesResponse,
  type TrafficQueueResponse,
  type TrafficConflictsResponse,
} from '../services/api'
import StatusBadge from '../components/StatusBadge'

type TrafficTabId = 'live' | 'queue' | 'conflicts' | 'congestion'
type BoardView = 'arrivals' | 'departures'

export default function TrafficManagement() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TrafficTabId>('live')
  const [boardView, setBoardView] = useState<BoardView>('arrivals')
  const [filterDelayedOnly, setFilterDelayedOnly] = useState<boolean>(false)

  const [overview, setOverview] = useState<TrafficOverviewResponse | null>(null)
  const [arrivalsData, setArrivalsData] = useState<TrafficArrivalsResponse | null>(null)
  const [departuresData, setDeparturesData] = useState<TrafficDeparturesResponse | null>(null)
  const [queueData, setQueueData] = useState<TrafficQueueResponse | null>(null)
  const [conflictsData, setConflictsData] = useState<TrafficConflictsResponse | null>(null)

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4500)
  }

  // Load all traffic analytics data
  const loadTrafficData = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, arr, dep, q, conf] = await Promise.all([
        api.getTrafficOverview(),
        api.getTrafficArrivals(),
        api.getTrafficDepartures(),
        api.getTrafficQueue(),
        api.getTrafficConflicts(),
      ])
      setOverview(ov)
      setArrivalsData(arr)
      setDeparturesData(dep)
      setQueueData(q)
      setConflictsData(conf)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load traffic monitoring data'
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrafficData()
  }, [loadTrafficData])

  // Synchronize telemetry via external API provider
  const handleSyncTelemetry = async () => {
    setSyncing(true)
    try {
      const res = await api.syncTrafficTelemetry()
      showToast(res.message, 'success')
      await loadTrafficData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Telemetry synchronization failed'
      showToast(msg, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const tabs = [
    { id: 'live' as const, label: 'Live Traffic Board', icon: Radio },
    { id: 'queue' as const, label: `Pending Queue (${queueData?.totalInQueue || 0})`, icon: Clock },
    { id: 'conflicts' as const, label: `Conflicts (${conflictsData?.totalConflicts || 0})`, icon: AlertTriangle },
    { id: 'congestion' as const, label: 'Congestion & Peak Hours', icon: BarChart3 },
  ]

  // Filtered lists
  const currentArrivals = (arrivalsData?.arrivals || []).filter(t => !filterDelayedOnly || t.isDelayed)
  const currentDepartures = (departuresData?.departures || []).filter(t => !filterDelayedOnly || t.isDelayed)

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedback && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-lg border px-4 py-3 shadow-2xl transition-all ${
          feedback.type === 'success'
            ? 'border-rail-green/40 bg-[#14231b] text-rail-green'
            : 'border-rail-red/40 bg-[#281515] text-rail-red'
        }`}>
          {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span className="text-xs font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Railway Traffic Management</h1>
            <span className="rounded bg-rail-orange/15 border border-rail-orange/30 px-2 py-0.5 text-[10px] font-bold text-rail-orange uppercase tracking-wider">
              Stage 9 Active
            </span>
          </div>
          <p className="mt-1 text-sm text-rail-muted">
            Live movement monitoring, queue prioritization, conflict detection, and congestion analytics for Itarsi Junction (ET)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Provider status badge */}
          <div className="flex items-center gap-1.5 rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs">
            <div className={`h-2 w-2 rounded-full ${overview?.summary.isOffline ? 'bg-rail-amber' : 'bg-rail-green animate-pulse'}`} />
            <span className="text-rail-muted text-[11px]">Provider:</span>
            <span className="font-semibold text-white truncate max-w-[150px]" title={overview?.summary.activeProvider}>
              {overview?.summary.activeProvider?.split('(')[0].trim() || 'External API'}
            </span>
          </div>

          <button
            onClick={handleSyncTelemetry}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-rail-orange px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rail-orange-dark transition-colors disabled:opacity-50"
            title="Synchronize live train running status and delays from external railway API"
          >
            {syncing ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span>{syncing ? 'Syncing...' : 'Sync Live Traffic'}</span>
          </button>

          <button
            onClick={loadTrafficData}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs font-medium text-rail-muted hover:text-white transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1: Incoming Trains */}
        <div className="rounded-xl border border-rail-border bg-rail-charcoal p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-rail-muted">
            <span>Incoming Trains</span>
            <ArrowDownLeft size={16} className="text-rail-blue" />
          </div>
          <p className="text-2xl font-black text-white">{overview?.summary.incomingTrains || 0}</p>
          <p className="text-[10px] text-rail-muted">En route to Itarsi Junction</p>
        </div>

        {/* Card 2: Departing Trains */}
        <div className="rounded-xl border border-rail-border bg-rail-charcoal p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-rail-muted">
            <span>Departing Trains</span>
            <ArrowUpRight size={16} className="text-rail-green" />
          </div>
          <p className="text-2xl font-black text-white">{overview?.summary.departingTrains || 0}</p>
          <p className="text-[10px] text-rail-muted">Berthed or scheduled departures</p>
        </div>

        {/* Card 3: Delayed Trains */}
        <div className="rounded-xl border border-rail-border bg-rail-charcoal p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-rail-muted">
            <span>Delayed Trains</span>
            <AlertTriangle size={16} className="text-rail-amber" />
          </div>
          <p className="text-2xl font-black text-rail-amber">{overview?.summary.delayedTrains || 0}</p>
          <p className="text-[10px] text-rail-muted">Reported running delays &gt; 0m</p>
        </div>

        {/* Card 4: Pending Platform Requests */}
        <div className="rounded-xl border border-rail-border bg-rail-charcoal p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-rail-muted">
            <span>Pending Platform Requests</span>
            <Clock size={16} className="text-rail-orange" />
          </div>
          <p className="text-2xl font-black text-rail-orange">{overview?.summary.pendingPlatformRequests || 0}</p>
          <p className="text-[10px] text-rail-muted">Awaiting platform allocation</p>
        </div>
      </div>

      {/* Congestion & Safety Status Sub-Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rail-border bg-rail-charcoal px-4 py-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-rail-muted text-[10px] block">Platform Utilization</span>
            <span className="font-bold text-white text-sm">
              {overview?.summary.platformOccupancyPercent || 0}%
            </span>
          </div>
          <div className="h-6 w-px bg-rail-border" />
          <div>
            <span className="text-rail-muted text-[10px] block">Detected Conflicts</span>
            <span className={`font-bold text-sm ${overview?.summary.activeConflictsCount ? 'text-rail-red' : 'text-rail-green'}`}>
              {overview?.summary.activeConflictsCount || 0} active
            </span>
          </div>
          <div className="h-6 w-px bg-rail-border" />
          <div>
            <span className="text-rail-muted text-[10px] block">Station Congestion Level</span>
            <span className={`inline-flex items-center gap-1 font-bold ${
              overview?.summary.stationCongestionLevel === 'HIGH' ? 'text-rail-red' :
              overview?.summary.stationCongestionLevel === 'MODERATE' ? 'text-rail-amber' : 'text-rail-green'
            }`}>
              {overview?.summary.stationCongestionLevel || 'LOW'}
            </span>
          </div>
        </div>

        <div className="text-right text-[10px] text-rail-muted">
          <span>Last sync: </span>
          <span className="text-white font-mono">
            {overview?.summary.lastSyncTimestamp
              ? new Date(overview.summary.lastSyncTimestamp).toLocaleTimeString()
              : 'Local DB'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 rounded-xl border border-rail-border bg-rail-charcoal p-1 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-rail-orange text-white'
                  : 'text-rail-muted hover:bg-rail-surface hover:text-white'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* TAB 1: LIVE TRAFFIC BOARD */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          {/* Sub-Header & Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBoardView('arrivals')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  boardView === 'arrivals'
                    ? 'bg-rail-blue/20 border-rail-blue text-rail-blue font-bold'
                    : 'bg-rail-surface border-rail-border text-rail-muted hover:text-white'
                }`}
              >
                <ArrowDownLeft size={14} />
                <span>Arrivals Queue ({arrivalsData?.total || 0})</span>
              </button>
              <button
                onClick={() => setBoardView('departures')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  boardView === 'departures'
                    ? 'bg-rail-green/20 border-rail-green text-rail-green font-bold'
                    : 'bg-rail-surface border-rail-border text-rail-muted hover:text-white'
                }`}
              >
                <ArrowUpRight size={14} />
                <span>Departures Queue ({departuresData?.total || 0})</span>
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-rail-muted cursor-pointer">
              <input
                type="checkbox"
                checked={filterDelayedOnly}
                onChange={e => setFilterDelayedOnly(e.target.checked)}
                className="rounded border-rail-border bg-rail-surface text-rail-orange focus:ring-0"
              />
              <span>Show Delayed Trains Only ({overview?.summary.delayedTrains || 0})</span>
            </label>
          </div>

          {/* Table Container */}
          <div className="rounded-xl border border-rail-border bg-rail-charcoal overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rail-border bg-rail-surface/60 text-[10px] text-rail-muted uppercase">
                    <th className="py-3 px-3">Train</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Route</th>
                    <th className="py-3 px-3">Scheduled</th>
                    <th className="py-3 px-3">Expected (Delay)</th>
                    <th className="py-3 px-3">Platform</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rail-border/40">
                  {(boardView === 'arrivals' ? currentArrivals : currentDepartures).map(t => (
                    <tr key={t.trainNumber} className="hover:bg-rail-surface/40 transition-colors">
                      <td className="py-3 px-3 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <TrainIcon size={14} className="text-rail-orange shrink-0" />
                          <span>{t.trainNumber}</span>
                          <span className="text-[11px] font-normal text-rail-muted truncate max-w-[140px]" title={t.trainName}>
                            {t.trainName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={t.category} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-[11px] text-zinc-300">
                        {t.origin} → {t.destination}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-white">
                        {t.scheduledTime}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white">{t.expectedTime}</span>
                          {t.delayMinutes > 0 ? (
                            <span className="rounded bg-rail-red/20 px-1 py-0.2 text-[9px] font-bold text-rail-red">
                              +{t.delayMinutes}m
                            </span>
                          ) : (
                            <span className="rounded bg-rail-green/20 px-1 py-0.2 text-[9px] font-bold text-rail-green">
                              On Time
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {t.platformId ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rail-surface border border-rail-border px-2 py-0.5 text-[11px] font-bold text-white">
                            <Layers size={10} className="text-rail-orange" />
                            PF {t.platformId}
                          </span>
                        ) : (
                          <span className="rounded bg-rail-amber/15 border border-rail-amber/30 px-2 py-0.5 text-[10px] font-bold text-rail-amber">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          t.status === 'BERTHED' ? 'bg-rail-green/20 text-rail-green border border-rail-green/30' :
                          t.status === 'ARRIVING' ? 'bg-rail-blue/20 text-rail-blue border border-rail-blue/30' :
                          t.status === 'DELAYED' ? 'bg-rail-amber/20 text-rail-amber border border-rail-amber/30' :
                          'bg-rail-surface text-rail-muted border border-rail-border'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded bg-rail-surface border border-rail-border/60 px-1.5 py-0.5 text-[9px] text-zinc-400">
                          {t.dataSource === 'EXTERNAL_API' ? 'API Telemetry' : 'Timetable'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!t.platformId ? (
                          <button
                            onClick={() => navigate('/allocation')}
                            className="inline-flex items-center gap-1 rounded bg-rail-orange/15 hover:bg-rail-orange text-rail-orange hover:text-white px-2 py-1 text-[11px] font-bold transition-colors"
                          >
                            <span>Allocate</span>
                            <ArrowRight size={11} />
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate('/allocation')}
                            className="text-[11px] text-rail-muted hover:text-white transition-colors"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(boardView === 'arrivals' ? currentArrivals : currentDepartures).length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-rail-muted">
                        No trains match the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING QUEUE & PRIORITIZATION */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-rail-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-rail-orange" />
                Platform Allocation Queue Management
              </h2>
              <p className="text-xs text-rail-muted mt-0.5">
                Pending train requests ranked by category priority, reported delay, and arrival headway
              </p>
            </div>
            <span className="rounded bg-rail-surface border border-rail-border px-2.5 py-1 text-xs text-zinc-300">
              {queueData?.urgentCount || 0} Urgent Requests
            </span>
          </div>

          <div className="space-y-3">
            {(queueData?.queue || []).map(q => (
              <div
                key={q.trainId}
                className={`rounded-xl border p-4 space-y-3 transition-colors ${
                  q.priorityLevel === 'URGENT'
                    ? 'border-rail-red/40 bg-rail-red/5'
                    : q.priorityLevel === 'HIGH'
                    ? 'border-rail-orange/40 bg-rail-orange/5'
                    : 'border-rail-border bg-rail-charcoal'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rail-surface border border-rail-border text-xs font-black text-white">
                      #{q.queuePosition}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{q.trainNumber} — {q.trainName}</span>
                        <StatusBadge status={q.category} size="sm" />
                      </div>
                      <p className="text-[11px] text-rail-muted">{q.origin} → {q.destination} · {q.coaches} coaches</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-white">
                        Arrival: {q.scheduledArrival}
                      </span>
                      {q.delayMinutes > 0 ? (
                        <span className="text-[10px] text-rail-red block">
                          Expected {q.expectedArrival} (+{q.delayMinutes}m delay)
                        </span>
                      ) : (
                        <span className="text-[10px] text-rail-green block">On Schedule</span>
                      )}
                    </div>

                    <div className="text-right min-w-[70px]">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                        q.priorityLevel === 'URGENT' ? 'bg-rail-red/20 text-rail-red border border-rail-red/30' :
                        q.priorityLevel === 'HIGH' ? 'bg-rail-orange/20 text-rail-orange border border-rail-orange/30' :
                        'bg-rail-surface text-rail-muted border border-rail-border'
                      }`}>
                        {q.priorityLevel}
                      </span>
                      <span className="block text-[9px] text-rail-muted mt-0.5">Score {q.priorityScore}/100</span>
                    </div>

                    <button
                      onClick={() => navigate('/allocation')}
                      className="rounded-lg bg-rail-orange hover:bg-rail-orange-dark px-3 py-1.5 text-xs font-bold text-white transition-colors flex items-center gap-1.5"
                    >
                      <span>Assign</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Prioritization Rationale */}
                <div className="flex items-start gap-2 text-xs text-zinc-300 bg-rail-surface/60 p-2.5 rounded border border-rail-border/60">
                  <Zap size={13} className="text-rail-orange shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <span className="font-semibold text-white">Queue Rationale: </span>
                    {q.priorityReason}
                  </p>
                </div>
              </div>
            ))}

            {(queueData?.queue || []).length === 0 && (
              <div className="rounded-xl border border-rail-border bg-rail-charcoal p-12 text-center text-xs text-rail-muted space-y-2">
                <CheckCircle size={32} className="text-rail-green mx-auto" />
                <p className="text-sm font-bold text-white">No Pending Platform Requests</p>
                <p>All scheduled trains currently have valid platform berths assigned.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SCHEDULING CONFLICTS */}
      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-rail-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-rail-red" />
                Platform Conflict & Buffer Overlap Detection
              </h2>
              <p className="text-xs text-rail-muted mt-0.5">
                Active schedule clashes and safety clearance buffer violations on station platforms
              </p>
            </div>
            <span className="rounded bg-rail-surface border border-rail-border px-2.5 py-1 text-xs text-zinc-300">
              {conflictsData?.totalConflicts || 0} Total Conflicts
            </span>
          </div>

          <div className="space-y-3">
            {(conflictsData?.conflicts || []).map(conf => (
              <div
                key={conf.conflictId}
                className={`rounded-xl border p-4 space-y-3 ${
                  conf.severity === 'HIGH'
                    ? 'border-rail-red/50 bg-rail-red/10'
                    : 'border-rail-amber/50 bg-rail-amber/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                      conf.severity === 'HIGH' ? 'bg-rail-red text-white' : 'bg-rail-amber text-black'
                    }`}>
                      {conf.severity} SEVERITY
                    </span>
                    <h3 className="text-sm font-bold text-white">{conf.platformName} Conflict</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    Overlap Window: {conf.overlapMinutes} mins
                  </span>
                </div>

                <p className="text-xs text-zinc-200">{conf.description}</p>

                <div className="grid grid-cols-2 gap-3 text-xs bg-rail-charcoal/80 p-3 rounded-lg border border-rail-border">
                  <div>
                    <span className="text-[10px] text-rail-muted block">Train 1</span>
                    <span className="font-bold text-white">{conf.trainA.number} — {conf.trainA.name}</span>
                    <span className="font-mono text-zinc-400 block">{conf.trainA.window}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rail-muted block">Train 2</span>
                    <span className="font-bold text-white">{conf.trainB.number} — {conf.trainB.name}</span>
                    <span className="font-mono text-zinc-400 block">{conf.trainB.window}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-zinc-300 bg-rail-surface/60 p-2.5 rounded border border-rail-border/60">
                  <Info size={14} className="text-rail-orange shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold text-white">Suggested Resolution: </span>
                    {conf.suggestedAction}
                  </p>
                </div>
              </div>
            ))}

            {(conflictsData?.conflicts || []).length === 0 && (
              <div className="rounded-xl border border-rail-green/30 bg-rail-green/5 p-12 text-center text-xs text-rail-muted space-y-2">
                <ShieldCheck size={36} className="text-rail-green mx-auto" />
                <p className="text-sm font-bold text-white">No Schedule Conflicts Detected</p>
                <p>All berthed and scheduled trains maintain required 15-minute buffer headways.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CONGESTION & PEAK HOURS */}
      {activeTab === 'congestion' && (
        <div className="space-y-6">
          {/* Disclaimer Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-rail-border bg-rail-charcoal p-4 text-xs text-rail-muted">
            <Info size={16} className="text-rail-orange shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block">Congestion Analytics Specification</span>
              <p className="mt-0.5 leading-relaxed">
                {overview?.congestionNotice}
              </p>
            </div>
          </div>

          {/* Hourly Traffic Movements Bar Chart */}
          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">24-Hour Station Movement Density</h3>
                <p className="text-xs text-rail-muted">Scheduled arrivals and departures distribution across 24 hours</p>
              </div>
              <span className="rounded bg-rail-surface px-2.5 py-1 text-xs text-rail-muted border border-rail-border">
                Itarsi Junction (ET)
              </span>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview?.hourlyDensity || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e32" vertical={false} />
                  <XAxis dataKey="hour" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#232326', border: '1px solid #2e2e32', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#71717a' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#71717a' }} />
                  <Bar dataKey="arrivals" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Arrivals" />
                  <Bar dataKey="departures" fill="#22c55e" radius={[2, 2, 0, 0]} name="Departures" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Busy Station Periods Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Identified Peak Operating Windows</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(overview?.busyPeriods || []).map((b, i) => (
                <div key={i} className="rounded-xl border border-rail-border bg-rail-charcoal p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rail-orange">{b.label}</span>
                    <span className="text-xs font-mono font-bold text-white">{b.trainCount} moves</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-white block">{b.timeWindow}</span>
                  <p className="text-[11px] text-rail-muted leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
