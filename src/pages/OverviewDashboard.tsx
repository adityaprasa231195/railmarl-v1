import { useState, useEffect, useCallback } from 'react'
import {
  Layers, Train, ArrowDownToLine, ArrowUpFromLine, Clock,
  CheckCircle, Calendar, Activity, AlertTriangle, RefreshCw, Database,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import { activityLog, hourlyOccupancy } from '../data/mockData'
import { api, type DashboardSummary } from '../services/api'
import type { Platform, Train as TrainType } from '../data/mockData'

export default function OverviewDashboard() {
  const [activeTab, setActiveTab] = useState<'activity' | 'upcoming'>('activity')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [trains, setTrains] = useState<TrainType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, platformsRes, trainsRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getPlatforms(),
        api.getTrains(),
      ])
      setSummary(summaryRes)
      setPlatforms(platformsRes)
      setTrains(trainsRes)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to RAILMARL backend'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const available = summary ? summary.availablePlatforms : platforms.filter(p => (p.status || '').toLowerCase() === 'available').length
  const occupied = summary ? summary.occupiedPlatforms : platforms.filter(p => (p.status || '').toLowerCase() === 'occupied').length
  const reserved = summary ? summary.reservedPlatforms : platforms.filter(p => (p.status || '').toLowerCase() === 'reserved').length
  const incoming = summary ? summary.incomingTrains : trains.filter(t => t.status === 'approaching' || t.status === 'on-time').length
  const departing = summary ? summary.departingTrains : trains.filter(t => t.status === 'arrived').length
  const delayed = summary ? summary.delayedTrains : trains.filter(t => t.status === 'delayed' || (t.delay ?? 0) > 0).length
  const totalPlatforms = summary ? summary.totalPlatforms : platforms.length

  const upcomingTrains = [...trains]
    .filter(t => t.status !== 'departed')
    .sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime))

  const activityIcons: Record<string, typeof Activity> = {
    arrival: ArrowDownToLine,
    departure: ArrowUpFromLine,
    allocation: Layers,
    delay: AlertTriangle,
    alert: AlertTriangle,
  }

  const activityColors: Record<string, string> = {
    arrival: 'text-rail-green',
    departure: 'text-rail-blue',
    allocation: 'text-rail-orange',
    delay: 'text-rail-red',
    alert: 'text-rail-red',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview Dashboard</h1>
          <p className="mt-1 text-sm text-rail-muted">
            Station overview live from FastAPI & SQLite database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-rail-border bg-rail-charcoal px-3 py-1.5 text-xs text-rail-muted">
            <Database size={13} className={error ? 'text-rail-red' : 'text-rail-green'} />
            <span>{error ? 'Database Offline' : 'SQLite Connected'}</span>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs font-medium text-rail-muted hover:text-white hover:bg-rail-surface/80 transition-colors disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rail-red/30 bg-rail-red/10 p-4 text-xs text-rail-red">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}. Ensure the FastAPI backend is running on port 8000.</span>
          </div>
          <button
            onClick={loadData}
            className="rounded-lg bg-rail-red/20 px-3 py-1 font-semibold hover:bg-rail-red/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Platforms" value={loading ? '...' : totalPlatforms} icon={Layers} subtitle="Configured tracks" />
        <StatCard title="Available" value={loading ? '...' : available} icon={CheckCircle} iconColor="text-rail-green" subtitle="Ready for allocation" />
        <StatCard title="Occupied" value={loading ? '...' : occupied} icon={Train} iconColor="text-rail-amber" subtitle="Trains berthed" />
        <StatCard title="Reserved" value={loading ? '...' : reserved} icon={Calendar} iconColor="text-rail-blue" subtitle="Pre-allocated" />
        <StatCard title="Incoming" value={loading ? '...' : incoming} icon={ArrowDownToLine} iconColor="text-rail-green" subtitle="Approaching / on-time" />
        <StatCard title="Departures" value={loading ? '...' : departing} icon={ArrowUpFromLine} iconColor="text-rail-blue" subtitle={delayed > 0 ? `${delayed} train delayed` : 'On schedule'} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Occupancy Chart */}
        <div className="lg:col-span-2 rounded-xl border border-rail-border bg-rail-charcoal p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Platform Occupancy Trend</h2>
              <p className="text-xs text-rail-muted mt-0.5">Hourly station capacity utilization</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-rail-surface px-2.5 py-1">
              <Clock size={12} className="text-rail-muted" />
              <span className="text-xs text-rail-muted">Today</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={hourlyOccupancy}>
              <defs>
                <linearGradient id="occupancyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e32" vertical={false} />
              <XAxis dataKey="hour" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ background: '#232326', border: '1px solid #2e2e32', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#71717a' }}
                itemStyle={{ color: '#f97316' }}
              />
              <Area type="monotone" dataKey="occupancy" stroke="#f97316" strokeWidth={2} fill="url(#occupancyGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Platform Status Grid */}
        <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Platform Status</h2>
            <span className="text-[10px] text-rail-muted">{platforms.length} tracks</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-rail-surface/60" />
              ))}
            </div>
          ) : platforms.length === 0 ? (
            <div className="py-12 text-center text-xs text-rail-muted">
              No platform records in database.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {platforms.map(p => (
                <div
                  key={p.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    (p.status || '').toLowerCase() === 'available'
                      ? 'border-rail-green/30 bg-rail-green/5'
                      : (p.status || '').toLowerCase() === 'occupied'
                      ? 'border-rail-amber/30 bg-rail-amber/5'
                      : (p.status || '').toLowerCase() === 'reserved'
                      ? 'border-rail-blue/30 bg-rail-blue/5'
                      : 'border-zinc-700/60 bg-zinc-800/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white">PF {p.id}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-[10px] text-rail-muted">{p.type} — {p.length}m</p>
                  {p.assignedTrain && (
                    <p className="text-[10px] text-rail-muted mt-0.5 truncate">{p.trainName || p.assignedTrain}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Activity / Upcoming Tabs */}
        <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5">
          <div className="mb-4 flex items-center gap-4 border-b border-rail-border pb-3">
            <button
              onClick={() => setActiveTab('activity')}
              className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                activeTab === 'activity'
                  ? 'border-rail-orange text-rail-orange'
                  : 'border-transparent text-rail-muted hover:text-white'
              }`}
            >
              Recent Activity
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                activeTab === 'upcoming'
                  ? 'border-rail-orange text-rail-orange'
                  : 'border-transparent text-rail-muted hover:text-white'
              }`}
            >
              Upcoming Trains ({upcomingTrains.length})
            </button>
          </div>

          {activeTab === 'activity' ? (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {activityLog.map(log => {
                const IconComp = activityIcons[log.type] || Activity
                const color = activityColors[log.type] || 'text-rail-muted'
                return (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-md bg-rail-surface p-1.5 ${color}`}>
                      <IconComp size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white">{log.message}</p>
                      <p className="text-[10px] text-rail-muted mt-0.5">{log.timestamp}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-rail-surface/60" />
                  ))}
                </div>
              ) : upcomingTrains.length === 0 ? (
                <div className="py-12 text-center text-xs text-rail-muted">
                  No upcoming train records.
                </div>
              ) : (
                upcomingTrains.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg bg-rail-surface p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white truncate">{t.name}</p>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-[10px] text-rail-muted mt-0.5">
                        {t.number} · {t.origin} → {t.destination}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-white font-medium">{t.arrivalTime}</p>
                      <p className="text-[10px] text-rail-muted">
                        {t.platform ? `PF ${t.platform}` : 'Unassigned'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Quick Summary Panels */}
        <div className="space-y-4">
          {/* Incoming Trains */}
          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <ArrowDownToLine size={14} className="text-rail-green" />
              Incoming Trains
            </h2>
            <div className="space-y-2">
              {loading ? (
                <div className="h-14 animate-pulse rounded-lg bg-rail-surface/60" />
              ) : trains.filter(t => t.status === 'approaching' || t.status === 'on-time').length === 0 ? (
                <p className="text-xs text-rail-muted py-2">No incoming trains at this time.</p>
              ) : (
                trains.filter(t => t.status === 'approaching' || t.status === 'on-time').map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-rail-surface px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-white">{t.name}</p>
                      <p className="text-[10px] text-rail-muted">{t.number} from {t.origin}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white">{t.arrivalTime}</p>
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Departures */}
          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <ArrowUpFromLine size={14} className="text-rail-blue" />
              Upcoming Departures
            </h2>
            <div className="space-y-2">
              {loading ? (
                <div className="h-14 animate-pulse rounded-lg bg-rail-surface/60" />
              ) : trains.filter(t => t.status === 'arrived').length === 0 ? (
                <p className="text-xs text-rail-muted py-2">No trains berthed for departure.</p>
              ) : (
                trains.filter(t => t.status === 'arrived').map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-rail-surface px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-white">{t.name}</p>
                      <p className="text-[10px] text-rail-muted">{t.number} to {t.destination}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white">{t.departureTime}</p>
                      <p className="text-[10px] text-rail-muted">PF {t.platform}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
