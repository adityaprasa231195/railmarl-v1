import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle, Clock, Train as TrainIcon,
  Zap, Info, RefreshCw, Sliders, Check, RotateCcw,
  LogOut, Layers, ShieldCheck, XCircle, ArrowRight, Brain
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import {
  api,
  type AllocationRecord,
  type RecommendationResponse,
  type SuggestedPlatform,
} from '../services/api'
import type { Train as TrainType } from '../data/mockData'

export default function SmartAllocation() {
  const [allocations, setAllocations] = useState<AllocationRecord[]>([])
  const [trains, setTrains] = useState<TrainType[]>([])
  const [selectedTrainId, setSelectedTrainId] = useState<string>('')
  const [bufferMinutes, setBufferMinutes] = useState<number>(15)
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [recLoading, setRecLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<string>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback(null)
    }, 4500)
  }

  // Load all data from live backend
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [allocRes, trainsRes] = await Promise.all([
        api.getAllocations(),
        api.getTrains(),
      ])
      setAllocations(allocRes)
      setTrains(trainsRes)

      // Auto-select first train needing allocation if none selected
      const unassigned = trainsRes.filter(t => !t.platform && t.status !== 'DEPARTED' && t.status !== 'CANCELLED')
      if (unassigned.length > 0 && !selectedTrainId) {
        setSelectedTrainId(unassigned[0].id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch allocation records'
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedTrainId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Generate recommendations for currently selected train
  const fetchRecommendation = useCallback(async (trainId: string, buf: number) => {
    if (!trainId) {
      setRecommendation(null)
      return
    }
    setRecLoading(true)
    try {
      const res = await api.recommendPlatform(trainId, buf)
      setRecommendation(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recommendation generation failed'
      showToast(msg, 'error')
      setRecommendation(null)
    } finally {
      setRecLoading(false)
    }
  }, [])

  // Auto-fetch recommendation when selectedTrainId or bufferMinutes changes
  useEffect(() => {
    if (selectedTrainId) {
      fetchRecommendation(selectedTrainId, bufferMinutes)
    }
  }, [selectedTrainId, bufferMinutes, fetchRecommendation])

  // Confirm platform allocation
  const handleConfirmAllocation = async (platformId: number, status: string = 'RESERVED') => {
    if (!selectedTrainId) return
    setActionLoading(`allocate-${platformId}`)
    try {
      const created = await api.createAllocation({
        trainId: selectedTrainId,
        platformId,
        status,
        notes: `Confirmed via RAILMARL Smart Allocation (${bufferMinutes}m buffer)`,
        bufferMinutes,
      })
      showToast(`Platform ${platformId} assigned to train ${created.trainNumber || selectedTrainId}. Status: ${created.status}.`)
      await loadData()
      // Refresh recommendation
      fetchRecommendation(selectedTrainId, bufferMinutes)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm platform allocation'
      showToast(msg, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // Cancel allocation
  const handleCancelAllocation = async (allocId: string) => {
    setActionLoading(`cancel-${allocId}`)
    try {
      const cancelled = await api.cancelAllocation(allocId)
      showToast(`Allocation ${cancelled.id} cancelled. Platform ${cancelled.platformId} released.`)
      await loadData()
      if (selectedTrainId) {
        fetchRecommendation(selectedTrainId, bufferMinutes)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel allocation'
      showToast(msg, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // Release platform allocation (departure)
  const handleReleaseAllocation = async (allocId: string) => {
    setActionLoading(`release-${allocId}`)
    try {
      const released = await api.releaseAllocation(allocId)
      showToast(`Platform ${released.platformId} released. Train departed.`)
      await loadData()
      if (selectedTrainId) {
        fetchRecommendation(selectedTrainId, bufferMinutes)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to release platform'
      showToast(msg, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // Derived datasets
  const unassignedTrains = trains.filter(
    t => !t.platform && t.status !== 'DEPARTED' && t.status !== 'CANCELLED'
  )
  const activeAllocations = allocations.filter(
    a => ['RESERVED', 'ACTIVE', 'reserved', 'active'].includes(a.status)
  )
  const pendingAllocations = allocations.filter(
    a => ['PENDING', 'pending'].includes(a.status)
  )
  const completedAllocations = allocations.filter(
    a => ['COMPLETED', 'completed'].includes(a.status)
  )

  const filteredHistory = allocations.filter(a => {
    if (historyFilter === 'all') return true
    return a.status.toUpperCase() === historyFilter.toUpperCase()
  })

  const selectedTrain = trains.find(t => t.id === selectedTrainId)

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Smart Platform Allocation</h1>
          <p className="mt-1 text-sm text-rail-muted">
            Deterministic rule-based decision engine for Itarsi Junction track berthing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadData()
              if (selectedTrainId) fetchRecommendation(selectedTrainId, bufferMinutes)
            }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs font-medium text-rail-muted hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Engine</span>
          </button>
        </div>
      </div>

      {/* Rule-Based Disclaimer Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-rail-orange/30 bg-rail-orange/5 p-4">
        <Info size={16} className="text-rail-orange shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-rail-orange uppercase tracking-wider">Deterministic Rule-Based Automation</p>
            <span className="rounded bg-rail-orange/20 px-1.5 py-0.5 text-[9px] font-bold text-rail-orange">Not ML</span>
          </div>
          <p className="text-xs text-rail-muted mt-1 leading-relaxed">
            Recommendations are computed algorithmically from scheduled arrival/departure intervals, physical platform length vs rake coach count,
            track routing classifications (Main, Through, Bay, Goods), and configurable clearance buffers. Conflicting dwell windows are automatically excluded.
          </p>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-rail-border bg-rail-charcoal p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-rail-amber" />
            <span className="text-xs font-medium text-rail-muted">Trains Needing Platform</span>
          </div>
          <p className="text-2xl font-bold text-white">{unassignedTrains.length}</p>
        </div>

        <div className="rounded-lg border border-rail-border bg-rail-charcoal p-4">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={14} className="text-rail-blue" />
            <span className="text-xs font-medium text-rail-muted">Pending Requests</span>
          </div>
          <p className="text-2xl font-bold text-white">{pendingAllocations.length}</p>
        </div>

        <div className="rounded-lg border border-rail-border bg-rail-charcoal p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-rail-green" />
            <span className="text-xs font-medium text-rail-muted">Active / Reserved</span>
          </div>
          <p className="text-2xl font-bold text-white">{activeAllocations.length}</p>
        </div>

        <div className="rounded-lg border border-rail-border bg-rail-charcoal p-4">
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw size={14} className="text-zinc-400" />
            <span className="text-xs font-medium text-rail-muted">Completed Runs</span>
          </div>
          <p className="text-2xl font-bold text-white">{completedAllocations.length}</p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Train Selection & Configuration (4 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrainIcon size={16} className="text-rail-orange" />
                Select Train for Allocation
              </h2>
              <span className="text-[11px] text-rail-muted">
                {unassignedTrains.length} unscheduled
              </span>
            </div>

            {/* Train Selector Dropdown */}
            <div>
              <label className="block text-xs font-medium text-rail-muted mb-1.5">
                Target Train
              </label>
              <select
                value={selectedTrainId}
                onChange={e => setSelectedTrainId(e.target.value)}
                className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white focus:border-rail-orange focus:outline-none"
              >
                <option value="" disabled>-- Select a train --</option>
                {unassignedTrains.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.number} — {t.name} ({t.arrivalTime} - {t.departureTime}) [Unassigned]
                  </option>
                ))}
                {trains.filter(t => t.platform).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.number} — {t.name} (Assigned to PF {t.platform})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Train Details Card */}
            {selectedTrain && (
              <div className="rounded-lg border border-rail-border/60 bg-rail-surface p-3.5 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-white">{selectedTrain.name}</span>
                    <p className="text-[11px] text-rail-muted">{selectedTrain.number} · {selectedTrain.origin} → {selectedTrain.destination}</p>
                  </div>
                  <StatusBadge status={selectedTrain.category} />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-rail-border/40 text-[11px]">
                  <div>
                    <span className="text-rail-muted block">Arrival</span>
                    <span className="font-semibold text-white">{selectedTrain.arrivalTime}</span>
                  </div>
                  <div>
                    <span className="text-rail-muted block">Departure</span>
                    <span className="font-semibold text-white">{selectedTrain.departureTime}</span>
                  </div>
                  <div>
                    <span className="text-rail-muted block">Coaches</span>
                    <span className="font-semibold text-white">{selectedTrain.coaches} (~{selectedTrain.coaches * 24}m)</span>
                  </div>
                </div>
                {selectedTrain.platform && (
                  <div className="rounded bg-rail-blue/10 border border-rail-blue/20 p-2 text-[10px] text-rail-blue">
                    Currently assigned to Platform {selectedTrain.platform}. You can reassign or evaluate alternatives.
                  </div>
                )}
              </div>
            )}

            {/* Clearance Buffer Configuration */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-rail-muted flex items-center gap-1.5">
                  <Sliders size={13} className="text-rail-orange" />
                  Clearance Buffer Window
                </label>
                <span className="text-xs font-bold text-rail-orange">{bufferMinutes} minutes</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[10, 15, 20, 30].map(buf => (
                  <button
                    key={buf}
                    type="button"
                    onClick={() => setBufferMinutes(buf)}
                    className={`rounded-md py-1.5 text-xs font-medium border transition-colors ${
                      bufferMinutes === buf
                        ? 'border-rail-orange bg-rail-orange/15 text-rail-orange font-bold'
                        : 'border-rail-border bg-rail-surface text-rail-muted hover:text-white'
                    }`}
                  >
                    {buf}m
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-rail-muted mt-1.5">
                Mandatory minimum safety interval required between successive berthings on the same track.
              </p>
            </div>

            {/* Quick Unassigned Trains Queue */}
            <div>
              <label className="block text-xs font-semibold text-rail-muted mb-2">
                Unassigned Queue ({unassignedTrains.length})
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {unassignedTrains.length === 0 ? (
                  <div className="rounded-lg border border-rail-border/40 bg-rail-surface p-3 text-center text-xs text-rail-muted">
                    All trains currently have assigned platforms.
                  </div>
                ) : (
                  unassignedTrains.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTrainId(t.id)}
                      className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                        selectedTrainId === t.id
                          ? 'border-rail-orange bg-rail-orange/10'
                          : 'border-rail-border bg-rail-surface hover:border-rail-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{t.number} — {t.name}</span>
                        <StatusBadge status={t.category} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-rail-muted mt-1">
                        <span>{t.arrivalTime} - {t.departureTime}</span>
                        <span>{t.coaches} coaches</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Engine Recommendation & Alternatives (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-rail-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap size={16} className="text-rail-orange" />
                  Engine Recommendation Output
                </h2>
                <p className="text-xs text-rail-muted mt-0.5">
                  Ranked by track compatibility, coach clearance, and timeline conflict checks
                </p>
              </div>
              {recommendation && (
                <div className="text-right">
                  <span className="text-[10px] text-rail-muted block">Clearance Window (±{bufferMinutes}m)</span>
                  <span className="text-xs font-mono font-bold text-rail-orange">{recommendation.clearanceWindow}</span>
                </div>
              )}
            </div>

            {recLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw size={24} className="text-rail-orange animate-spin" />
                <p className="text-xs text-rail-muted">Evaluating platform constraints & schedule intervals...</p>
              </div>
            ) : !selectedTrainId ? (
              <div className="py-12 text-center text-rail-muted text-xs">
                Select a train from the left panel to generate recommendations.
              </div>
            ) : !recommendation ? (
              <div className="py-12 text-center text-rail-muted text-xs">
                No recommendation data available for this train.
              </div>
            ) : (
              <div className="space-y-5">
                {/* Top Recommended Platform Card */}
                {recommendation.recommended ? (
                  <div className="rounded-xl border-2 border-rail-orange bg-rail-orange/5 p-4 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-rail-orange text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-lg tracking-wider uppercase">
                      Top Match · Rank #1
                    </div>

                    <div className="flex items-center justify-between pr-24">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">
                            {recommendation.recommended.platformName}
                          </h3>
                          <span className="rounded bg-rail-surface border border-rail-border px-2 py-0.5 text-[10px] font-medium text-rail-muted">
                            {recommendation.recommended.trackType} Track
                          </span>
                        </div>
                        <p className="text-xs text-rail-muted mt-0.5">
                          Length: {recommendation.recommended.length}m · Max Coaches: {recommendation.recommended.maxCoaches}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-rail-orange">
                          {recommendation.recommended.score}%
                        </span>
                        <span className="block text-[9px] uppercase tracking-wider text-rail-muted">Fitness Score</span>
                      </div>
                    </div>

                    {/* Engineering Rationale */}
                    <div className="space-y-1.5 pt-2 border-t border-rail-orange/20">
                      <p className="text-[11px] font-semibold text-white">Engineering Rationale:</p>
                      {recommendation.recommended.reasons.map((reason, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                          <CheckCircle size={13} className="text-rail-green shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>

                    {/* Smart Platform Clearance Predictor (Stage 8) */}
                    {recommendation.mlPrediction && (
                      <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Brain size={14} className="text-purple-400" />
                            <span className="text-[11px] font-bold text-purple-300">
                              Smart Platform Clearance Predictor
                            </span>
                            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-medium text-purple-300">
                              {recommendation.mlPrediction.algorithm || 'DecisionTreeRegressor'}
                            </span>
                          </div>
                          {recommendation.mlPrediction.isModelReady && recommendation.mlPrediction.confidence && (
                            <span className="text-[10px] font-bold text-purple-300">
                              Confidence: {recommendation.mlPrediction.confidence}%
                            </span>
                          )}
                        </div>

                        {recommendation.mlPrediction.isModelReady ? (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-rail-charcoal/70 p-2.5 rounded border border-purple-500/20">
                              <div>
                                <span className="text-rail-muted text-[10px] block">Train ID</span>
                                <span className="font-bold text-white">{recommendation.trainNumber}</span>
                              </div>
                              <div>
                                <span className="text-rail-muted text-[10px] block">Scheduled Window</span>
                                <span className="text-zinc-300 text-[11px]">
                                  {recommendation.mlPrediction.scheduledArrivalFormatted || recommendation.arrivalTime} → {recommendation.mlPrediction.scheduledDepartureFormatted || recommendation.departureTime}
                                </span>
                              </div>
                              <div>
                                <span className="text-purple-300 text-[10px] block font-medium">Predicted Occupancy</span>
                                <span className="font-bold text-purple-300">
                                  {recommendation.mlPrediction.predictedDurationMinutes} mins
                                </span>
                              </div>
                              <div>
                                <span className="text-rail-orange text-[10px] block font-medium">Estimated Clearance</span>
                                <span className="font-mono font-bold text-rail-orange">
                                  {recommendation.mlPrediction.estimatedClearanceTimeFormatted || recommendation.mlPrediction.estimatedClearanceTime}
                                </span>
                              </div>
                            </div>

                            {/* Future Reservation Conflict Warning (Stage 8) */}
                            {recommendation.mlPrediction.clearanceConflictWarning ? (
                              <div className="rounded border border-rail-amber/40 bg-rail-amber/10 p-2.5 text-xs text-rail-amber flex items-start gap-2">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rail-amber" />
                                <div>
                                  <span className="font-semibold block">Clearance Buffer Warning</span>
                                  <p className="text-[11px] text-zinc-300 mt-0.5">
                                    {recommendation.mlPrediction.clearanceConflictWarning}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-zinc-400 italic">
                                {recommendation.mlPrediction.advisoryNote}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-[11px] text-rail-muted">
                            Advisory Decision Tree model untrained or insufficient data. Rule-based allocation active.
                          </div>
                        )}
                        <p className="text-[9px] text-zinc-500">
                          Advisory ML prediction — physical allocation and anti-collision buffer ({bufferMinutes}m) remain strictly enforced by Stage 5 safety checks.
                        </p>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        onClick={() => handleConfirmAllocation(recommendation.recommended!.platformId, 'RESERVED')}
                        disabled={actionLoading !== null}
                        className="flex-1 rounded-lg bg-rail-orange py-2 px-4 text-xs font-bold text-white hover:bg-rail-orange-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {actionLoading === `allocate-${recommendation.recommended.platformId}` ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                        <span>Confirm & Allocate {recommendation.recommended.platformName}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-rail-red/40 bg-rail-red/10 p-4 text-center">
                    <AlertTriangle size={20} className="text-rail-red mx-auto mb-2" />
                    <p className="text-xs font-bold text-rail-red">No Conflict-Free Platforms Available</p>
                    <p className="text-[11px] text-rail-muted mt-1">
                      All operational platforms have overlapping dwell times or rake length restrictions for this window ({recommendation.occupancyWindow}).
                    </p>
                  </div>
                )}

                {/* Alternative Platforms List */}
                {recommendation.alternatives.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Alternative Platforms Evaluated ({recommendation.alternatives.length})
                    </h3>
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {recommendation.alternatives.map((alt) => (
                        <AlternativeCard
                          key={alt.platformId}
                          alt={alt}
                          onAllocate={() => handleConfirmAllocation(alt.platformId, 'RESERVED')}
                          isAllocating={actionLoading === `allocate-${alt.platformId}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Track Allocations Strip (Quick Release / Cancel) */}
      <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers size={16} className="text-rail-blue" />
              Active Platform Berthings & Reservations
            </h2>
            <p className="text-xs text-rail-muted mt-0.5">
              Live platforms currently occupied or reserved. Release on train departure to return platform to Available.
            </p>
          </div>
          <span className="text-xs text-rail-muted font-mono">{activeAllocations.length} active</span>
        </div>

        {activeAllocations.length === 0 ? (
          <div className="rounded-lg border border-rail-border/40 bg-rail-surface p-6 text-center text-xs text-rail-muted">
            No active allocations currently recorded. Confirm an allocation above to berth a train.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeAllocations.map(alloc => (
              <div
                key={alloc.id}
                className="rounded-lg border border-rail-border bg-rail-surface p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-white">{alloc.platformName || `Platform ${alloc.platformId}`}</span>
                    <p className="text-[11px] text-rail-muted">Train {alloc.trainNumber} · {alloc.trainName}</p>
                  </div>
                  <StatusBadge status={alloc.status} />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-300 bg-rail-charcoal px-2.5 py-1.5 rounded">
                  <span>Dwell: {alloc.occupancyStart || '--'} - {alloc.occupancyEnd || '--'}</span>
                  <span className="text-rail-orange font-bold">Fit: {alloc.score}%</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleReleaseAllocation(alloc.id)}
                    disabled={actionLoading !== null}
                    className="flex-1 rounded border border-rail-green/30 bg-rail-green/10 py-1.5 text-[11px] font-semibold text-rail-green hover:bg-rail-green/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    title="Mark train departed and release platform to AVAILABLE"
                  >
                    {actionLoading === `release-${alloc.id}` ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <LogOut size={11} />
                    )}
                    <span>Release Platform</span>
                  </button>

                  <button
                    onClick={() => handleCancelAllocation(alloc.id)}
                    disabled={actionLoading !== null}
                    className="rounded border border-rail-red/30 bg-rail-red/10 px-2.5 py-1.5 text-[11px] font-semibold text-rail-red hover:bg-rail-red/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    title="Cancel allocation assignment"
                  >
                    {actionLoading === `cancel-${alloc.id}` ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <XCircle size={11} />
                    )}
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete Allocation Lifecycle & History Table */}
      <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-rail-muted" />
              Allocation Lifecycle History & Audit Log
            </h2>
            <p className="text-xs text-rail-muted mt-0.5">
              Persistent transaction log stored in SQLite database
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-rail-border bg-rail-surface p-1">
            {['all', 'RESERVED', 'ACTIVE', 'PENDING', 'COMPLETED', 'CANCELLED'].map(tab => (
              <button
                key={tab}
                onClick={() => setHistoryFilter(tab)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium uppercase transition-colors ${
                  historyFilter === tab
                    ? 'bg-rail-orange text-white'
                    : 'text-rail-muted hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-rail-border text-[11px] font-semibold text-rail-muted uppercase tracking-wider">
                <th className="pb-3 pl-2">ID</th>
                <th className="pb-3">Train</th>
                <th className="pb-3">Platform</th>
                <th className="pb-3">Dwell Window</th>
                <th className="pb-3">Score</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Recorded</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rail-border/40">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-rail-muted">
                    No allocation records found matching this status filter.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(rec => {
                  const isLive = ['RESERVED', 'ACTIVE', 'reserved', 'active'].includes(rec.status)
                  return (
                    <tr key={rec.id} className="hover:bg-rail-surface/40 transition-colors">
                      <td className="py-3 pl-2 font-mono text-[11px] text-rail-muted">{rec.id}</td>
                      <td className="py-3">
                        <div className="font-semibold text-white">{rec.trainName || rec.trainId}</div>
                        <div className="text-[10px] text-rail-muted">{rec.trainNumber || ''}</div>
                      </td>
                      <td className="py-3">
                        <span className="font-medium text-white">{rec.platformName || `PF ${rec.platformId}`}</span>
                      </td>
                      <td className="py-3 text-[11px] font-mono text-zinc-300">
                        {rec.occupancyStart || '--'} → {rec.occupancyEnd || '--'}
                      </td>
                      <td className="py-3 font-bold text-rail-orange">{rec.score}%</td>
                      <td className="py-3">
                        <StatusBadge status={rec.status} />
                      </td>
                      <td className="py-3 text-[11px] text-rail-muted">
                        {rec.createdAt ? new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-3 text-right pr-2">
                        {isLive ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleReleaseAllocation(rec.id)}
                              disabled={actionLoading !== null}
                              className="rounded bg-rail-green/10 border border-rail-green/30 px-2 py-1 text-[10px] font-semibold text-rail-green hover:bg-rail-green/20"
                              title="Release platform (Train departed)"
                            >
                              Release
                            </button>
                            <button
                              onClick={() => handleCancelAllocation(rec.id)}
                              disabled={actionLoading !== null}
                              className="rounded bg-rail-red/10 border border-rail-red/30 px-2 py-1 text-[10px] font-semibold text-rail-red hover:bg-rail-red/20"
                              title="Cancel allocation"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-rail-muted italic">Archived</span>
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
  )
}

function AlternativeCard({
  alt,
  onAllocate,
  isAllocating,
}: {
  alt: SuggestedPlatform
  onAllocate: () => void
  isAllocating: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      alt.isAvailable
        ? 'border-rail-border bg-rail-surface hover:border-rail-muted/50'
        : 'border-rail-red/30 bg-rail-red/5'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">{alt.platformName}</span>
          <span className="text-[10px] text-rail-muted">({alt.trackType} · {alt.length}m)</span>
          {alt.isAvailable ? (
            <span className="rounded bg-rail-green/15 text-rail-green border border-rail-green/30 px-1.5 py-0.2 text-[9px] font-bold">
              Available
            </span>
          ) : (
            <span className="rounded bg-rail-red/15 text-rail-red border border-rail-red/30 px-1.5 py-0.2 text-[9px] font-bold">
              Conflict Detected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-rail-orange">{alt.score}%</span>
          {alt.isAvailable && (
            <button
              onClick={onAllocate}
              disabled={isAllocating}
              className="rounded bg-rail-surface border border-rail-orange/50 px-2 py-1 text-[10px] font-semibold text-rail-orange hover:bg-rail-orange hover:text-white transition-colors flex items-center gap-1"
            >
              {isAllocating ? <RefreshCw size={10} className="animate-spin" /> : <ArrowRight size={10} />}
              <span>Assign</span>
            </button>
          )}
        </div>
      </div>

      {/* Reasons or Conflicts */}
      {alt.conflicts.length > 0 ? (
        <div className="space-y-1 mt-1 text-[11px] text-rail-red">
          {alt.conflicts.map((c, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5 text-rail-red" />
              <span>{c}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-0.5 mt-1 text-[11px] text-zinc-400">
          {alt.reasons.slice(0, 2).map((r, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <CheckCircle size={11} className="shrink-0 mt-0.5 text-rail-green" />
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
