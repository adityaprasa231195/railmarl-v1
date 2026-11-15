import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Target, Brain, Info, Activity,
  RefreshCw, Play, CheckCircle, AlertTriangle,
  Database, Zap, Sparkles, Check
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts'
import {
  api,
  type MLStatusResponse,
  type MLMetricsResponse,
  type PredictResponse,
  type PredictionHistoryItem,
} from '../services/api'
import { hourlyOccupancy, platformUsageWeekly } from '../data/mockData'
import type { Train as TrainType } from '../data/mockData'
import StatusBadge from '../components/StatusBadge'

type TabId = 'inference' | 'dwell' | 'occupancy' | 'performance'

export default function MLInsights() {
  const [activeTab, setActiveTab] = useState<TabId>('inference')
  const [status, setStatus] = useState<MLStatusResponse | null>(null)
  const [metrics, setMetrics] = useState<MLMetricsResponse | null>(null)
  const [history, setHistory] = useState<PredictionHistoryItem[]>([])
  const [trains, setTrains] = useState<TrainType[]>([])
  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)
  const [predicting, setPredicting] = useState(false)
  const [selectedAlgo, setSelectedAlgo] = useState<'DecisionTree' | 'RandomForest'>('DecisionTree')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Interactive Prediction Form State
  const [selectedTrainId, setSelectedTrainId] = useState<string>('')
  const [predForm, setPredForm] = useState({
    trainNumber: 'SIM-001',
    trainCategory: 'EXPRESS',
    scheduledArrival: '10:30',
    scheduledDeparture: '10:45',
    coaches: 18,
    platformId: 1,
  })
  const [predictionResult, setPredictionResult] = useState<PredictResponse | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4500)
  }

  // Load live ML status, metrics, prediction logs, and trains
  const loadMLData = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, metricsRes, histRes, trainsRes] = await Promise.all([
        api.getMLStatus(),
        api.getMLMetrics(),
        api.getMLPredictionHistory(20),
        api.getTrains(),
      ])
      setStatus(statusRes)
      setMetrics(metricsRes)
      setHistory(histRes)
      setTrains(trainsRes)

      if (trainsRes.length > 0 && !selectedTrainId) {
        const first = trainsRes[0]
        setSelectedTrainId(first.id)
        setPredForm({
          trainNumber: first.number,
          trainCategory: first.category,
          scheduledArrival: first.arrivalTime,
          scheduledDeparture: first.departureTime,
          coaches: first.coaches,
          platformId: first.platform || 1,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch ML model status'
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedTrainId])

  useEffect(() => {
    loadMLData()
  }, [loadMLData])

  // Trigger Model Training / Retraining with selected algorithm (DecisionTree or RandomForest)
  const handleTrainModel = async (algo: 'DecisionTree' | 'RandomForest' = selectedAlgo) => {
    setTraining(true)
    try {
      const res = await api.trainMLModel(algo)
      if (res.success) {
        showToast(`Model successfully trained with ${algo} on ${res.sampleCount} records (MAE: ${res.mae}m, RMSE: ${res.rmse}m).`)
      } else {
        showToast(res.message, 'error')
      }
      await loadMLData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Training failed'
      showToast(msg, 'error')
    } finally {
      setTraining(false)
    }
  }

  // Seed demonstration data if insufficient
  const handleSeedBenchmarkData = async () => {
    setTraining(true)
    try {
      const res = await api.seedMLSynthetic(70)
      showToast(res.message)
      await loadMLData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to seed benchmark data'
      showToast(msg, 'error')
    } finally {
      setTraining(false)
    }
  }

  // Train selector change
  const handleSelectTrain = (trainId: string) => {
    setSelectedTrainId(trainId)
    const t = trains.find(item => item.id === trainId)
    if (t) {
      setPredForm({
        trainNumber: t.number,
        trainCategory: t.category,
        scheduledArrival: t.arrivalTime,
        scheduledDeparture: t.departureTime,
        coaches: t.coaches,
        platformId: t.platform || 1,
      })
    }
  }

  // Run live ML clearance prediction
  const handleRunPrediction = async () => {
    setPredicting(true)
    try {
      const res = await api.predictOccupancy({
        trainId: selectedTrainId || undefined,
        trainNumber: predForm.trainNumber,
        trainCategory: predForm.trainCategory,
        scheduledArrival: predForm.scheduledArrival,
        scheduledDeparture: predForm.scheduledDeparture,
        coaches: predForm.coaches,
        platformId: predForm.platformId,
      })
      setPredictionResult(res)
      showToast(`Predicted duration: ${res.predictedDurationMinutes} mins. Est. clearance: ${res.estimatedClearanceTimeFormatted || res.estimatedClearanceTime}.`)
      // Refresh prediction history
      const updatedHist = await api.getMLPredictionHistory(20)
      setHistory(updatedHist)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Prediction request failed'
      showToast(msg, 'error')
    } finally {
      setPredicting(false)
    }
  }

  const tabs = [
    { id: 'inference' as const, label: 'Smart Clearance Predictor', icon: Brain },
    { id: 'dwell' as const, label: 'Dwell Time: Actual vs Predicted', icon: Activity },
    { id: 'occupancy' as const, label: 'Station Occupancy Trends', icon: TrendingUp },
    { id: 'performance' as const, label: 'Model Evaluation & Specs', icon: Target },
  ]

  return (
    <div className="space-y-6">
      {/* Toast */}
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
          <h1 className="text-2xl font-bold text-white">Smart Platform Clearance Predictor</h1>
          <p className="mt-1 text-sm text-rail-muted">
            Stage 8: Decision Tree machine-learning model forecasting platform occupancy duration and clearance times
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Algorithm selector */}
          <select
            value={selectedAlgo}
            onChange={e => setSelectedAlgo(e.target.value as 'DecisionTree' | 'RandomForest')}
            className="rounded-lg border border-rail-border bg-rail-surface px-2.5 py-1.5 text-xs text-white"
            title="Select regression algorithm"
          >
            <option value="DecisionTree">DecisionTreeRegressor (Stage 8)</option>
            <option value="RandomForest">RandomForestRegressor (Stage 6)</option>
          </select>

          <button
            onClick={() => handleTrainModel(selectedAlgo)}
            disabled={training}
            className="flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            title="Train or retrain Scikit-learn model on historical occupancy data"
          >
            {training ? <RefreshCw size={13} className="animate-spin text-purple-400" /> : <Play size={13} className="text-purple-400" />}
            <span>{training ? 'Training...' : 'Retrain Model'}</span>
          </button>

          <button
            onClick={loadMLData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs font-medium text-rail-muted hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Synthetic Dataset Notice Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
        <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-purple-300 uppercase tracking-wider">
              Stage 8 Machine Learning Architecture
            </p>
            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
              Scikit-Learn · {status?.algorithm || 'DecisionTreeRegressor'}
            </span>
          </div>
          <p className="text-xs text-rail-muted mt-1 leading-relaxed">
            The platform clearance predictor uses Scikit-Learn DecisionTreeRegressor trained on completed station occupancy records ({status?.totalTrainingRecords || 0} valid samples).
            All historical records are clearly labelled synthetic demonstration data for Itarsi Junction testing. Predictions are advisory and never override physical clearance rules.
          </p>
        </div>
      </div>

      {/* Insufficient Training Data Alert if under threshold */}
      {status?.status === 'INSUFFICIENT_DATA' && (
        <div className="rounded-xl border border-rail-amber/40 bg-rail-amber/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-rail-amber shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rail-amber">Insufficient Training Data</p>
              <p className="text-xs text-zinc-300 mt-0.5">
                The predictor requires at least {status?.minSamplesRequired || 15} completed records to train. Currently found {status?.totalTrainingRecords || 0} records.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeedBenchmarkData}
            disabled={training}
            className="rounded-lg bg-rail-amber/20 border border-rail-amber/40 px-3 py-1.5 text-xs font-bold text-rail-amber hover:bg-rail-amber/30 transition-colors whitespace-nowrap"
          >
            Seed 70 Benchmark Records & Train
          </button>
        </div>
      )}

      {/* KPI Performance Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-rail-border bg-rail-charcoal p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-rail-muted">Model Status</span>
            <Brain size={14} className="text-purple-400" />
          </div>
          <div className="mt-1">
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${
              status?.status === 'TRAINED'
                ? 'bg-rail-green/15 text-rail-green border border-rail-green/30'
                : 'bg-rail-amber/15 text-rail-amber border border-rail-amber/30'
            }`}>
              {status?.status === 'TRAINED' ? <Check size={11} /> : <AlertTriangle size={11} />}
              {status?.status || 'UNTRAINED'}
            </span>
          </div>
          <p className="text-[10px] text-rail-muted mt-1 truncate" title={status?.algorithm || 'DecisionTreeRegressor'}>
            {status?.algorithm ? status.algorithm.split('(')[0].trim() : 'Decision Tree'}
          </p>
        </div>

        <div className="rounded-lg border border-rail-border bg-rail-charcoal p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-rail-muted">Mean Absolute Error</span>
            <Target size={14} className="text-rail-orange" />
          </div>
          <p className="text-2xl font-bold text-white">
            {metrics?.mae !== null && metrics?.mae !== undefined ? `${metrics.mae} min` : '--'}
          </p>
          <p className="text-[10px] text-rail-muted mt-0.5">Test split MAE</p>
        </div>

        <div className="rounded-lg border border-rail-border bg-rail-charcoal p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-rail-muted">Root Mean Squared Error</span>
            <Activity size={14} className="text-rail-blue" />
          </div>
          <p className="text-2xl font-bold text-white">
            {metrics?.rmse !== null && metrics?.rmse !== undefined ? `${metrics.rmse} min` : '--'}
          </p>
          <p className="text-[10px] text-rail-muted mt-0.5">Test split RMSE</p>
        </div>

        <div className="rounded-lg border border-rail-border bg-rail-charcoal p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-rail-muted">Valid Training Samples</span>
            <Database size={14} className="text-zinc-400" />
          </div>
          <p className="text-2xl font-bold text-white">
            {status?.totalTrainingRecords || 0}
          </p>
          <p className="text-[10px] text-rail-muted mt-0.5">
            Synthetic: {status?.syntheticRecords || 0} · Real: {status?.realRecords || 0}
          </p>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Tab 1: Smart Clearance Predictor */}
      {activeTab === 'inference' && (
        <div className="space-y-6">
          {/* Demonstration Format Showcase Card */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                Stage 8 Clearance Prediction Specification
              </span>
              <span className="text-[10px] text-rail-muted">Illustrative Specification Format</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 rounded-lg bg-rail-charcoal border border-purple-500/20 text-xs">
              <div>
                <span className="text-[10px] text-rail-muted block">Train</span>
                <span className="font-bold text-white">SIM-001</span>
              </div>
              <div>
                <span className="text-[10px] text-rail-muted block">Scheduled arrival</span>
                <span className="text-white font-mono">10:30 AM</span>
              </div>
              <div>
                <span className="text-[10px] text-rail-muted block">Scheduled departure</span>
                <span className="text-white font-mono">10:45 AM</span>
              </div>
              <div>
                <span className="text-[10px] text-purple-300 block font-medium">Predicted occupancy</span>
                <span className="text-purple-400 font-bold">18 minutes</span>
              </div>
              <div>
                <span className="text-[10px] text-rail-orange block font-medium">Estimated clearance</span>
                <span className="text-rail-orange font-bold font-mono">10:48 AM</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Form (5 cols) */}
            <div className="lg:col-span-5 rounded-xl border border-rail-border bg-rail-charcoal p-5 space-y-4">
              <div className="border-b border-rail-border pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Brain size={16} className="text-purple-400" />
                  Live Clearance Inference Engine
                </h2>
                <p className="text-xs text-rail-muted mt-0.5">
                  Select a train or enter timetable specs to compute clearance prediction
                </p>
              </div>

              {/* Quick Fill from Existing Train */}
              <div>
                <label className="block text-xs font-medium text-rail-muted mb-1">
                  Prefill from Timetable
                </label>
                <select
                  value={selectedTrainId}
                  onChange={e => handleSelectTrain(e.target.value)}
                  className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white focus:border-rail-orange focus:outline-none"
                >
                  <option value="">-- Custom Parameters --</option>
                  {trains.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.number} — {t.name} ({t.category}, {t.arrivalTime} - {t.departureTime})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-rail-muted mb-1">Train Number</label>
                  <input
                    type="text"
                    value={predForm.trainNumber}
                    onChange={e => setPredForm({ ...predForm, trainNumber: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-rail-muted mb-1">Category</label>
                  <select
                    value={predForm.trainCategory}
                    onChange={e => setPredForm({ ...predForm, trainCategory: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs text-white"
                  >
                    {['SUPERFAST', 'EXPRESS', 'PASSENGER', 'FREIGHT', 'OTHER'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-rail-muted mb-1">Scheduled Arrival</label>
                  <input
                    type="text"
                    placeholder="10:30"
                    value={predForm.scheduledArrival}
                    onChange={e => setPredForm({ ...predForm, scheduledArrival: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-rail-muted mb-1">Scheduled Departure</label>
                  <input
                    type="text"
                    placeholder="10:45"
                    value={predForm.scheduledDeparture}
                    onChange={e => setPredForm({ ...predForm, scheduledDeparture: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-rail-muted mb-1">Coach Count</label>
                  <input
                    type="number"
                    min="4"
                    max="48"
                    value={predForm.coaches}
                    onChange={e => setPredForm({ ...predForm, coaches: parseInt(e.target.value) || 18 })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-rail-muted mb-1">Target Platform</label>
                  <select
                    value={predForm.platformId}
                    onChange={e => setPredForm({ ...predForm, platformId: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-1.5 text-xs text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                      <option key={p} value={p}>Platform {p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleRunPrediction}
                disabled={predicting}
                className="w-full rounded-lg bg-rail-orange py-2 px-4 text-xs font-bold text-white hover:bg-rail-orange-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {predicting ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                <span>{predicting ? 'Calculating...' : 'Generate Clearance Prediction'}</span>
              </button>
            </div>

            {/* Prediction Result & History (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Live Result Card */}
              {predictionResult ? (
                <div className="rounded-xl border-2 border-purple-500/60 bg-purple-500/10 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                        Prediction Output
                      </span>
                      <h3 className="text-lg font-bold text-white">
                        Train {predictionResult.trainNumber} · {predictionResult.trainCategory}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-purple-300">
                        Confidence: {predictionResult.confidence}%
                      </span>
                      <span className="block text-[9px] text-rail-muted uppercase">
                        {predictionResult.algorithm ? predictionResult.algorithm.split('(')[0].trim() : 'Decision Tree'}
                      </span>
                    </div>
                  </div>

                  {/* Stage 8 Output Format Display */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-rail-charcoal border border-purple-500/20 text-center">
                    <div>
                      <span className="text-[10px] text-rail-muted block">Scheduled Arrival</span>
                      <span className="text-sm font-bold text-white">
                        {predictionResult.scheduledArrivalFormatted || predictionResult.scheduledArrival || '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rail-muted block">Scheduled Departure</span>
                      <span className="text-sm font-bold text-white">
                        {predictionResult.scheduledDepartureFormatted || predictionResult.scheduledDeparture || '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-purple-300 block">Predicted Occupancy</span>
                      <span className="text-base font-bold text-purple-400">
                        {predictionResult.predictedDurationMinutes} mins
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rail-orange block">Estimated Clearance</span>
                      <span className="text-base font-mono font-bold text-rail-orange">
                        {predictionResult.estimatedClearanceTimeFormatted || predictionResult.estimatedClearanceTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-zinc-300 bg-rail-surface/60 p-2.5 rounded border border-rail-border">
                    <Info size={14} className="text-purple-400 shrink-0 mt-0.5" />
                    <p>{predictionResult.advisoryNote}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-rail-border bg-rail-charcoal p-8 text-center text-xs text-rail-muted">
                  <Brain size={28} className="text-purple-400/50 mx-auto mb-2" />
                  Select or configure train parameters and click &ldquo;Generate Clearance Prediction&rdquo; to predict platform dwell duration.
                </div>
              )}

              {/* Recent Predictions History */}
              <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Recent Platform Predictions ({history.length})</span>
                  <span className="text-[10px] text-rail-muted font-normal">SQLite Persistent Log</span>
                </h3>

                {history.length === 0 ? (
                  <p className="text-xs text-rail-muted text-center py-4">No prediction logs recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-rail-border text-[10px] text-rail-muted uppercase">
                          <th className="pb-2">Train</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2">Sched Dwell</th>
                          <th className="pb-2">Predicted Occupancy</th>
                          <th className="pb-2">Est. Clearance</th>
                          <th className="pb-2">Actual Duration</th>
                          <th className="pb-2 text-right">Logged</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rail-border/30">
                        {history.slice(0, 8).map(h => (
                          <tr key={h.id} className="hover:bg-rail-surface/40">
                            <td className="py-2 text-white font-medium">{h.trainNumber}</td>
                            <td className="py-2"><StatusBadge status={h.trainCategory} size="sm" /></td>
                            <td className="py-2 text-zinc-400">{h.scheduledDwellMinutes}m</td>
                            <td className="py-2 font-bold text-purple-400">{h.predictedDurationMinutes}m</td>
                            <td className="py-2 font-mono text-rail-orange">
                              {h.estimatedClearanceTimeFormatted || h.estimatedClearanceTime}
                            </td>
                            <td className="py-2 text-zinc-300">
                              {h.actualDurationMinutes !== null && h.actualDurationMinutes !== undefined
                                ? `${h.actualDurationMinutes}m`
                                : '--'}
                            </td>
                            <td className="py-2 text-right text-[10px] text-rail-muted">
                              {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Dwell Time Actual vs Predicted */}
      {activeTab === 'dwell' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Actual vs Predicted Dwell Time (Test Split)</h3>
                <p className="text-xs text-rail-muted mt-0.5">
                  Comparison evaluated on the 20% test partition of completed records
                </p>
              </div>
              <span className="rounded bg-rail-surface px-2.5 py-1 text-xs text-rail-muted border border-rail-border">
                {metrics?.testSamples || metrics?.actualVsPredicted.length || 0} Test Samples
              </span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics?.actualVsPredicted || []} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e32" vertical={false} />
                  <XAxis dataKey="trainNumber" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} unit=" min" />
                  <Tooltip
                    contentStyle={{ background: '#232326', border: '1px solid #2e2e32', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#71717a' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#71717a' }} />
                  <Bar dataKey="predicted" fill="#a855f7" radius={[4, 4, 0, 0]} name="Predicted Duration (min)" />
                  <Bar dataKey="actual" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Actual Duration (min)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="rounded-xl border border-rail-border bg-rail-charcoal overflow-hidden p-5 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Test Sample Evaluation Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rail-border text-[11px] font-semibold text-rail-muted uppercase">
                    <th className="pb-3 pl-2">Train</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Scheduled Dwell</th>
                    <th className="pb-3">Predicted</th>
                    <th className="pb-3">Actual</th>
                    <th className="pb-3">Variance</th>
                    <th className="pb-3 text-right pr-2">Accuracy %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rail-border/40">
                  {(metrics?.actualVsPredicted || []).map((row, i) => (
                    <tr key={i} className="hover:bg-rail-surface/40 transition-colors">
                      <td className="py-2.5 pl-2 font-bold text-white">{row.trainNumber}</td>
                      <td className="py-2.5"><StatusBadge status={row.trainCategory} size="sm" /></td>
                      <td className="py-2.5 text-zinc-400">{row.scheduledDwell} min</td>
                      <td className="py-2.5 font-bold text-purple-400">{row.predicted} min</td>
                      <td className="py-2.5 font-bold text-rail-blue">{row.actual} min</td>
                      <td className={`py-2.5 font-mono ${row.variance > 0 ? 'text-rail-red' : 'text-rail-green'}`}>
                        {row.variance > 0 ? `+${row.variance}` : row.variance} min
                      </td>
                      <td className="py-2.5 text-right pr-2 font-semibold text-white">{row.accuracyPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Station Occupancy Trends */}
      {activeTab === 'occupancy' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Hourly Occupancy Trend</h3>
            <p className="text-xs text-rail-muted mb-4">Station track utilization across 24 hours</p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyOccupancy}>
                  <defs>
                    <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
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
                  />
                  <Area type="monotone" dataKey="occupancy" stroke="#f97316" strokeWidth={2} fill="url(#occGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Weekly Platform Usage Distribution</h3>
            <p className="text-xs text-rail-muted mb-4">Occupancy density per platform across days of the week</p>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformUsageWeekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e32" vertical={false} />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#232326', border: '1px solid #2e2e32', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#71717a' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#71717a' }} />
                  <Bar dataKey="pf1" fill="#f97316" radius={[2, 2, 0, 0]} name="PF 1" />
                  <Bar dataKey="pf2" fill="#3b82f6" radius={[2, 2, 0, 0]} name="PF 2" />
                  <Bar dataKey="pf3" fill="#22c55e" radius={[2, 2, 0, 0]} name="PF 3" />
                  <Bar dataKey="pf4" fill="#f59e0b" radius={[2, 2, 0, 0]} name="PF 4" />
                  <Bar dataKey="pf5" fill="#a855f7" radius={[2, 2, 0, 0]} name="PF 5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Model Performance & Architecture */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Feature Importances Chart */}
          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Model Feature Importances</h3>
            <p className="text-xs text-rail-muted mb-4">Gini importance weights calculated by Scikit-Learn</p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics?.featureImportances || []} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e32" horizontal={false} />
                  <XAxis type="number" stroke="#71717a" fontSize={11} domain={[0, 'auto']} />
                  <YAxis type="category" dataKey="feature" stroke="#71717a" fontSize={11} width={120} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#232326', border: '1px solid #2e2e32', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#71717a' }}
                  />
                  <Bar dataKey="importance" fill="#a855f7" radius={[0, 4, 4, 0]} name="Feature Importance" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Architecture Specs */}
          <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Model Architecture & Training Contract</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ConfigRow label="Primary Algorithm" value="Decision Tree Regressor (Scikit-Learn DecisionTreeRegressor, max depth 6, min samples split 4)" />
              <ConfigRow label="Fallback Algorithm" value="Random Forest Regressor (Scikit-Learn RandomForestRegressor, 100 estimators)" />
              <ConfigRow label="Target Variable" value="Actual platform occupancy duration in minutes" />
              <ConfigRow label="Feature Inputs" value="Train Category, Scheduled Dwell, Arrival Hour/Min, Time Slot, Day of Week, Coach Count, Platform ID" />
              <ConfigRow label="Leakage Prevention" value="Zero future leakage (actual clearance time and future events excluded from input features)" />
              <ConfigRow label="Persistence Format" value="Joblib serialized pipeline with ColumnTransformer" />
              <ConfigRow label="Role in System" value="Advisory clearance prediction and buffer warning (does not override platform availability checks)" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-rail-surface px-3.5 py-2.5 border border-rail-border/60">
      <p className="text-[10px] text-rail-muted mb-0.5">{label}</p>
      <p className="text-xs text-white leading-relaxed">{value}</p>
    </div>
  )
}
