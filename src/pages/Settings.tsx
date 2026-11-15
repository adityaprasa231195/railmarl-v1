import { useState, useEffect, useCallback } from 'react'
import {
  Settings as SettingsIcon,
  MapPin,
  Layers,
  Palette,
  Save,
  RotateCcw,
  Info,
  Globe,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ArrowDownToLine,
  Lock,
  Check,
  Clock,
} from 'lucide-react'
import {
  api,
  type RailwayAPIStatusResponse,
  type ExternalTrainSchedule,
  type TrainImportResponse,
} from '../services/api'

interface SettingsSection {
  id: string
  label: string
  icon: typeof SettingsIcon
}

const sections: SettingsSection[] = [
  { id: 'railway-api', label: 'Railway API Integration', icon: Globe },
  { id: 'station', label: 'Station Configuration', icon: MapPin },
  { id: 'platform', label: 'Platform Configuration', icon: Layers },
  { id: 'preferences', label: 'Application Preferences', icon: Palette },
]

export default function Settings() {
  const [activeSection, setActiveSection] = useState('railway-api')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    alert('Settings reset to default values.')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-sm text-rail-muted">
            Configure external railway data integration, station limits, and system parameters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-lg border border-rail-border bg-rail-surface px-4 py-2 text-xs font-medium text-rail-muted hover:text-white transition-colors"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors ${
              saved ? 'bg-rail-green' : 'bg-rail-orange hover:bg-rail-orange-dark'
            }`}
          >
            <Save size={14} />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Section Navigation */}
        <div className="space-y-1">
          {sections.map(s => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeSection === s.id
                    ? 'bg-rail-orange/15 text-rail-orange'
                    : 'text-rail-muted hover:bg-rail-surface hover:text-white'
                }`}
              >
                <Icon size={16} />
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 rounded-xl border border-rail-border bg-rail-charcoal p-6">
          {activeSection === 'railway-api' && <RailwayAPIConfig />}
          {activeSection === 'station' && <StationConfig />}
          {activeSection === 'platform' && <PlatformConfig />}
          {activeSection === 'preferences' && <AppPreferences />}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// STAGE 7: RAILWAY API INTEGRATION SETTINGS COMPONENT
// ============================================================

function RailwayAPIConfig() {
  const [apiStatus, setApiStatus] = useState<RailwayAPIStatusResponse | null>(null)
  const [, setLoadingStatus] = useState(true)
  const [testingConn, setTestingConn] = useState(false)
  const [testResult, setTestResult] = useState<{ isConnected: boolean; message: string } | null>(null)

  // Search & Import state
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ExternalTrainSchedule[]>([])
  const [selectedTrains, setSelectedTrains] = useState<Record<string, boolean>>({})
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<TrainImportResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [clearingCache, setClearingCache] = useState(false)

  // Load API provider status
  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const data = await api.getRailwayAPIStatus()
      setApiStatus(data)
    } catch (err) {
      console.error('Failed to fetch Railway API status:', err)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchStatus()
    handleSearch('ALL')
  }, [fetchStatus])

  // Test provider connection
  const handleTestConnection = async () => {
    setTestingConn(true)
    setTestResult(null)
    setErrorMessage(null)
    try {
      const res = await api.testRailwayAPIConnection()
      setTestResult({
        isConnected: res.isConnected,
        message: res.message,
      })
      await fetchStatus()
    } catch (err) {
      setTestResult({
        isConnected: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      })
    } finally {
      setTestingConn(false)
    }
  }

  // Clear in-memory API cache
  const handleClearCache = async () => {
    setClearingCache(true)
    try {
      await api.clearRailwayAPICache()
      await fetchStatus()
    } catch (err) {
      console.error('Failed to clear cache:', err)
    } finally {
      setClearingCache(false)
    }
  }

  // Search trains from external API or offline adapter
  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim() || 'ALL'
    setSearching(true)
    setErrorMessage(null)
    setImportResult(null)
    try {
      const res = await api.searchRailwayTrains(q, 'ET')
      setSearchResults(res.results)
      // Auto-select only new trains by default
      const initialSelection: Record<string, boolean> = {}
      res.results.forEach(t => {
        if (!t.alreadyExistsInLocalDb) {
          initialSelection[t.trainNumber] = true
        }
      })
      setSelectedTrains(initialSelection)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Train search failed')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  // Toggle selection
  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {}
    searchResults.forEach(t => {
      next[t.trainNumber] = checked
    })
    setSelectedTrains(next)
  }

  const toggleSelectOne = (trainNumber: string) => {
    setSelectedTrains(prev => ({
      ...prev,
      [trainNumber]: !prev[trainNumber],
    }))
  }

  const selectedCount = Object.values(selectedTrains).filter(Boolean).length

  // Import selected trains
  const handleImport = async () => {
    const trainsToImport = searchResults.filter(t => selectedTrains[t.trainNumber])
    if (trainsToImport.length === 0) return

    setImporting(true)
    setErrorMessage(null)
    setImportResult(null)
    try {
      const res = await api.importRailwayTrains(trainsToImport, overwriteExisting)
      setImportResult(res)
      // Refresh search results to update local DB status flags
      await handleSearch(searchQuery || 'ALL')
      await fetchStatus()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const quickSearchChips = [
    { label: 'All Itarsi Trains', query: 'ALL' },
    { label: '12627 Karnataka Exp', query: '12627' },
    { label: '12186 Rewanchal Exp', query: '12186' },
    { label: '12138 Punjab Mail', query: '12138' },
    { label: '22692 Rajdhani Exp', query: '22692' },
    { label: '12920 Malwa Exp', query: '12920' },
    { label: '51828 Shuttle', query: '51828' },
  ]

  return (
    <div className="space-y-6">
      {/* Provider Status Card */}
      <div className="rounded-xl border border-rail-border bg-rail-surface/40 p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sky-500/10 p-2.5 text-sky-400 border border-sky-500/20">
              <Globe size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">External Railway API Provider</h2>
                {apiStatus?.isConfigured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <Check size={10} /> RapidAPI Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                    Offline Demonstration Adapter
                  </span>
                )}
              </div>
              <p className="text-xs text-rail-muted mt-0.5">
                {apiStatus?.provider || 'Loading provider configuration...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearCache}
              disabled={clearingCache || (apiStatus?.cacheEntries ?? 0) === 0}
              className="rounded-lg border border-rail-border bg-rail-charcoal px-3 py-1.5 text-xs text-rail-muted hover:text-white transition-colors disabled:opacity-40"
              title="Clear in-memory API response cache"
            >
              Clear Cache ({apiStatus?.cacheEntries ?? 0})
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testingConn}
              className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={testingConn ? 'animate-spin' : ''} />
              <span>{testingConn ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2 border-t border-rail-border/60 text-xs">
          <div>
            <p className="text-rail-muted text-[11px]">Station Target</p>
            <p className="font-semibold text-white mt-0.5">Itarsi Junction (ET)</p>
          </div>
          <div>
            <p className="text-rail-muted text-[11px]">Connection Status</p>
            <p className="font-semibold text-emerald-400 mt-0.5">
              {apiStatus?.isConnected ? 'Operational' : 'Fallback Active'}
            </p>
          </div>
          <div>
            <p className="text-rail-muted text-[11px]">Cached Schedules</p>
            <p className="font-semibold text-zinc-300 mt-0.5">
              {apiStatus?.cacheEntries ?? 0} records
            </p>
          </div>
          <div>
            <p className="text-rail-muted text-[11px]">Last Synchronization</p>
            <p className="font-semibold text-zinc-300 mt-0.5">
              {apiStatus?.lastSyncTimestamp
                ? new Date(apiStatus.lastSyncTimestamp).toLocaleTimeString()
                : 'Not Synced'}
            </p>
          </div>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`rounded-lg p-3 text-xs flex items-start gap-2 border ${
              testResult.isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            {testResult.isConnected ? <CheckCircle size={15} className="shrink-0 mt-0.5" /> : <Info size={15} className="shrink-0 mt-0.5" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Train Search Tool */}
      <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Search size={15} className="text-rail-orange" />
            <span>Search & Retrieve External Railway Timetables</span>
          </h3>
          <p className="text-xs text-rail-muted mt-0.5">
            Query live train schedules and arrival/departure halts for Itarsi Junction (Station code ET)
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-rail-muted" />
            <input
              type="text"
              placeholder="Enter 5-digit train number (e.g. 12627, 22692) or name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full rounded-lg border border-rail-border bg-rail-surface pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-rail-orange transition-colors"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={searching}
            className="flex items-center gap-1.5 rounded-lg bg-rail-orange px-4 py-2 text-xs font-semibold text-white hover:bg-rail-orange-dark transition-colors disabled:opacity-50"
          >
            <Search size={13} />
            <span>{searching ? 'Querying...' : 'Search Timetable'}</span>
          </button>
        </div>

        {/* Quick Search Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-rail-muted mr-1">Quick Select:</span>
          {quickSearchChips.map(chip => (
            <button
              key={chip.query}
              onClick={() => {
                setSearchQuery(chip.query === 'ALL' ? '' : chip.query)
                handleSearch(chip.query)
              }}
              className="rounded-md border border-rail-border bg-rail-surface/60 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white hover:border-rail-orange/40 transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="rounded-lg border border-rail-red/30 bg-rail-red/10 p-3 text-xs text-rail-red flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Import Result Notification */}
        {importResult && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle size={15} className="shrink-0" />
              <span>
                Synchronization Complete: {importResult.importedCount} imported, {importResult.updatedCount} updated, {importResult.skippedCount} skipped.
              </span>
            </div>
            {importResult.results.map((r, i) => (
              <p key={i} className="text-[11px] text-emerald-300/80 pl-6">
                • {r.message}
              </p>
            ))}
          </div>
        )}

        {/* Search Results Table */}
        <div className="border border-rail-border rounded-xl overflow-hidden mt-2">
          <div className="flex items-center justify-between bg-rail-surface/80 px-4 py-3 border-b border-rail-border">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="select-all"
                checked={searchResults.length > 0 && selectedCount === searchResults.length}
                onChange={e => toggleSelectAll(e.target.checked)}
                className="rounded border-rail-border accent-rail-orange cursor-pointer"
              />
              <label htmlFor="select-all" className="text-xs font-semibold text-white cursor-pointer">
                Select All ({searchResults.length} schedules retrieved)
              </label>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-rail-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={e => setOverwriteExisting(e.target.checked)}
                  className="rounded border-rail-border accent-rail-orange cursor-pointer"
                />
                <span>Allow overwrite of existing records</span>
              </label>

              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors disabled:opacity-40"
              >
                <ArrowDownToLine size={13} />
                <span>{importing ? 'Importing...' : `Import Selected (${selectedCount})`}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-rail-border bg-rail-surface/40 text-rail-muted">
                  <th className="px-4 py-2.5 w-10"></th>
                  <th className="px-4 py-2.5">Train Number & Name</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Route</th>
                  <th className="px-4 py-2.5">Itarsi Halt (ET)</th>
                  <th className="px-4 py-2.5">Dwell</th>
                  <th className="px-4 py-2.5">Live Status</th>
                  <th className="px-4 py-2.5">Database Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rail-border/40">
                {searching ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xs text-rail-muted">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-rail-orange" />
                      <span>Querying railway timetables...</span>
                    </td>
                  </tr>
                ) : searchResults.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xs text-rail-muted">
                      No trains matching query. Enter a valid 5-digit number or try &apos;ALL&apos;.
                    </td>
                  </tr>
                ) : (
                  searchResults.map(t => {
                    const isSelected = !!selectedTrains[t.trainNumber]
                    return (
                      <tr
                        key={t.trainNumber}
                        onClick={() => toggleSelectOne(t.trainNumber)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-500/10' : 'hover:bg-rail-surface/30'
                        }`}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(t.trainNumber)}
                            className="rounded border-rail-border accent-rail-orange cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-rail-orange">{t.trainNumber}</span>
                            <span className="font-semibold text-white">{t.trainName}</span>
                          </div>
                          <p className="text-[11px] text-rail-muted mt-0.5">
                            {t.coaches} coaches · Runs: {t.runsOnDays.join(', ')}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-rail-surface text-zinc-300 border border-rail-border">
                            {t.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                          {t.origin} → {t.destination}
                        </td>
                        <td className="px-4 py-3 font-mono text-white whitespace-nowrap">
                          {t.arrivalTime} - {t.departureTime}
                          {t.isOvernight && (
                            <span className="ml-1 text-[9px] text-indigo-400 font-bold">+1d</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                          {t.dwellMinutes} mins
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {t.liveStatus ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                                t.liveStatus.delayMinutes <= 5
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              <Clock size={10} />
                              <span>{t.liveStatus.statusSummary}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-rail-muted">On Schedule</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {t.alreadyExistsInLocalDb ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 bg-rail-surface px-2 py-0.5 rounded border border-rail-border">
                              <Lock size={10} className="text-zinc-500" />
                              <span>Already in DB</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/30 font-medium">
                              <CheckCircle size={10} />
                              <span>New Schedule</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* API Setup Instructions & Safeguards */}
      <div className="rounded-xl border border-rail-border/60 bg-rail-surface/20 p-5 space-y-3 text-xs">
        <h4 className="font-bold text-white flex items-center gap-2">
          <Info size={15} className="text-sky-400" />
          <span>Configuration & Provider Credentials</span>
        </h4>
        <p className="text-rail-muted leading-relaxed">
          RAILMARL connects to external Indian Railway schedule services via RapidAPI or the built-in offline Central Railway adapter.
          To connect a live RapidAPI provider key, create a <code className="bg-rail-charcoal px-1.5 py-0.5 rounded border border-rail-border text-zinc-200">.env</code> file in your project root with:
        </p>
        <pre className="rounded-lg bg-rail-charcoal p-3 font-mono text-[11px] text-zinc-300 border border-rail-border overflow-x-auto">
{`RAILWAY_API_PROVIDER=rapidapi_irctc
RAILWAY_API_KEY=your_rapidapi_key_here
RAILWAY_API_HOST=indian-railway-irctc.p.rapidapi.com
RAILWAY_API_BASE_URL=https://indian-railway-irctc.p.rapidapi.com
RAILWAY_API_TIMEOUT=10
RAILWAY_API_CACHE_TTL_MINUTES=60`}
        </pre>
        <div className="flex items-start gap-2 text-zinc-400 bg-rail-surface/40 p-3 rounded-lg border border-rail-border/40">
          <Lock size={14} className="text-rail-orange shrink-0 mt-0.5" />
          <p className="text-[11px]">
            <strong>Safety & Isolation Guarantee:</strong> External railway data is strictly used for schedule import and tracking. External API payloads never automatically alter platform occupancy, override clearance buffers, or manipulate signalling systems.
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// EXISTING SETTINGS SECTIONS
// ============================================================

function StationConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Station Configuration</h2>
        <p className="text-xs text-rail-muted">General station parameters and operational details</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SettingsField label="Station Name" defaultValue="Itarsi Junction" />
        <SettingsField label="Station Code" defaultValue="ET" />
        <SettingsField label="Zone" defaultValue="West Central Railway (WCR)" />
        <SettingsField label="Division" defaultValue="Bhopal" />
        <SettingsField label="State" defaultValue="Madhya Pradesh" />
        <SettingsField label="Total Platforms" defaultValue="8" />
        <SettingsField label="Operating Hours" defaultValue="24 / 7" />
        <SettingsField label="Station Master on Duty" defaultValue="Senior Section Supervisor" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Operational Contacts (Demonstration)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Control Room Phone" defaultValue="+91-7572-XXXXXX" />
          <SettingsField label="Emergency Dispatch" defaultValue="+91-7572-XXXXXX" />
          <SettingsField label="Operational Email" defaultValue="control.et@demonstration.rail" />
          <SettingsField label="Signalling Section" defaultValue="ET-SSE-SIG-01" />
        </div>
      </div>
    </div>
  )
}

function PlatformConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Platform Configuration</h2>
        <p className="text-xs text-rail-muted">Platform dimensions, operational limits, and track roles</p>
      </div>

      <div className="rounded-xl border border-rail-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rail-border bg-rail-surface/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-rail-muted">Platform</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-rail-muted">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-rail-muted">Length (m)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-rail-muted">Max Coaches</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-rail-muted">Priority</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Platform 1', type: 'Main', length: 600, maxCoaches: 24, priority: 'High' },
              { name: 'Platform 2', type: 'Main', length: 550, maxCoaches: 22, priority: 'High' },
              { name: 'Platform 3', type: 'Through', length: 500, maxCoaches: 20, priority: 'Medium' },
              { name: 'Platform 4', type: 'Through', length: 480, maxCoaches: 19, priority: 'Medium' },
              { name: 'Platform 5', type: 'Through', length: 520, maxCoaches: 21, priority: 'Medium' },
              { name: 'Platform 6', type: 'Bay', length: 350, maxCoaches: 14, priority: 'Low' },
              { name: 'Platform 7', type: 'Bay', length: 300, maxCoaches: 12, priority: 'Low' },
              { name: 'Platform 8', type: 'Goods', length: 700, maxCoaches: 42, priority: 'Low' },
            ].map(p => (
              <tr key={p.name} className="border-b border-rail-border/50 hover:bg-rail-surface/30 transition-colors">
                <td className="px-4 py-2.5 text-xs font-medium text-white">{p.name}</td>
                <td className="px-4 py-2.5 text-xs text-rail-muted">{p.type}</td>
                <td className="px-4 py-2.5 text-xs text-rail-muted">{p.length}m</td>
                <td className="px-4 py-2.5 text-xs text-rail-muted">{p.maxCoaches}</td>
                <td className="px-4 py-2.5 text-xs text-rail-muted">{p.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Allocation Heuristics</h3>
        <div className="space-y-3">
          <ToggleSetting label="Auto-suggest Main platforms (PF 1 & 2) for Superfast/Mail rakes" defaultOn={true} />
          <ToggleSetting label="Dedicate Platform 8 for Freight operations" defaultOn={true} />
          <ToggleSetting label="Enforce rake length checks against platform physical limit" defaultOn={true} />
          <ToggleSetting label="Allow secondary platform assignment during peak headway" defaultOn={false} />
        </div>
      </div>
    </div>
  )
}

function AppPreferences() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Application Preferences</h2>
        <p className="text-xs text-rail-muted">Display, telemetry alerts, and refresh frequency</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Display & Format</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Color Theme" options={['Dark Charcoal (Default)', 'High Contrast Dark']} />
          <SelectField label="System Language" options={['English (IN)', 'Hindi']} />
          <SelectField label="Time Format" options={['24-hour (Railway)', '12-hour']} />
          <SelectField label="Date Format" options={['DD/MM/YYYY', 'YYYY-MM-DD']} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Notification Alerts</h3>
        <div className="space-y-3">
          <ToggleSetting label="Train approach & arrival notifications" defaultOn={true} />
          <ToggleSetting label="Schedule delay alert triggers (>10m)" defaultOn={true} />
          <ToggleSetting label="Platform conflict warning toasts" defaultOn={true} />
          <ToggleSetting label="AI allocation recommendation updates" defaultOn={true} />
          <ToggleSetting label="Audio signal indicators" defaultOn={false} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Telemetry & Polling</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Simulated Polling Interval" options={['15 seconds', '30 seconds', '1 minute', 'Manual only']} />
          <SelectField label="Activity Log History" options={['Last 50 entries', 'Last 100 entries', 'Current shift only']} />
        </div>
      </div>
    </div>
  )
}

function SettingsField({ label, defaultValue }: { label: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue)
  return (
    <div>
      <label className="text-xs text-rail-muted mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange/50 transition-colors"
      />
    </div>
  )
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <label className="text-xs text-rail-muted mb-1 block">{label}</label>
      <select className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange/50 transition-colors appearance-none cursor-pointer">
        {options.map(o => (
          <option key={o} value={o} className="bg-rail-charcoal text-white">
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function ToggleSetting({ label, defaultOn }: { label: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between rounded-lg bg-rail-surface px-3 py-2.5">
      <span className="text-xs text-white">{label}</span>
      <button
        onClick={() => setOn(!on)}
        type="button"
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-rail-orange' : 'bg-rail-border'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            on ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}
