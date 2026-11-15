import { useState, useEffect, useCallback } from 'react'
import {
  Layers, Search, Filter, Train, Clock, Ruler, CheckCircle,
  AlertCircle, ChevronDown, RefreshCw, AlertTriangle, Plus,
  Edit2, Trash2, Eye, X, Calendar, Info, LayoutGrid, List
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { api, type PlatformCreatePayload, type PlatformUpdatePayload } from '../services/api'
import type { Platform } from '../data/mockData'

type FilterStatus = 'all' | 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE'
type ViewMode = 'cards' | 'table'

interface FormErrors {
  id?: string
  name?: string
  length?: string
  max_coaches?: string
  status?: string
}

export default function PlatformManagement() {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Filters & Views
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [platformToEdit, setPlatformToEdit] = useState<Platform | null>(null)
  const [platformToDelete, setPlatformToDelete] = useState<Platform | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState<{
    id: number | ''
    name: string
    status: string
    type: string
    length: number | ''
    max_coaches: number | ''
    description: string
    features: string
  }>({
    id: '',
    name: '',
    status: 'AVAILABLE',
    type: 'Through',
    length: 500,
    max_coaches: 20,
    description: '',
    features: 'Covered, Display Board',
  })
  const [formErrors, setFormErrors] = useState<FormErrors>({})

  const showNotification = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => {
      setSuccessMsg(null)
    }, 4500)
  }

  const loadPlatforms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getPlatforms()
      setPlatforms(data)
      if (data.length > 0) {
        setSelectedPlatform(prev => (prev ? data.find(p => p.id === prev.id) || data[0] : data[0]))
      } else {
        setSelectedPlatform(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch platform records'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlatforms()
  }, [loadPlatforms])

  // Filter logic
  const filtered = platforms.filter(p => {
    const searchLower = search.toLowerCase().trim()
    const matchesSearch =
      !searchLower ||
      p.name.toLowerCase().includes(searchLower) ||
      String(p.id).includes(searchLower) ||
      (p.type && p.type.toLowerCase().includes(searchLower)) ||
      (p.assignedTrain && p.assignedTrain.toLowerCase().includes(searchLower)) ||
      (p.trainName && p.trainName.toLowerCase().includes(searchLower))

    const pStatusNormalized = (p.status || '').toUpperCase().replace('-', '_')
    const matchesStatus = filterStatus === 'all' || pStatusNormalized === filterStatus
    return matchesSearch && matchesStatus
  })

  // Open Add Modal
  const openAddModal = () => {
    // Propose next platform number
    const maxId = platforms.reduce((max, p) => (p.id > max ? p.id : max), 0)
    setFormData({
      id: maxId + 1,
      name: `Platform ${maxId + 1}`,
      status: 'AVAILABLE',
      type: 'Through',
      length: 500,
      max_coaches: 20,
      description: '',
      features: 'Covered, Display Board',
    })
    setFormErrors({})
    setModalError(null)
    setShowAddModal(true)
  }

  // Open Edit Modal
  const openEditModal = (platform: Platform) => {
    setPlatformToEdit(platform)
    setFormData({
      id: platform.id,
      name: platform.name,
      status: (platform.status || 'AVAILABLE').toUpperCase().replace('-', '_'),
      type: platform.type || 'Through',
      length: platform.length,
      max_coaches: platform.max_coaches || 20,
      description: platform.description || '',
      features: (platform.features || []).join(', '),
    })
    setFormErrors({})
    setModalError(null)
    setShowEditModal(true)
  }

  // Open Delete Confirmation Dialog
  const openDeleteDialog = (platform: Platform) => {
    setPlatformToDelete(platform)
    setModalError(null)
    setShowDeleteDialog(true)
  }

  // Form Validation
  const validateForm = (isEdit = false): boolean => {
    const errors: FormErrors = {}
    if (!isEdit) {
      if (formData.id === '' || Number(formData.id) <= 0) {
        errors.id = 'Platform ID must be a positive integer'
      } else if (platforms.some(p => p.id === Number(formData.id))) {
        errors.id = `Platform ID ${formData.id} already exists`
      }
    }

    if (!formData.name.trim()) {
      errors.name = 'Platform Name is required'
    } else if (
      platforms.some(
        p => p.name.toLowerCase() === formData.name.trim().toLowerCase() && (!isEdit || p.id !== platformToEdit?.id)
      )
    ) {
      errors.name = `Platform name '${formData.name}' already exists`
    }

    if (formData.length === '' || Number(formData.length) <= 0) {
      errors.length = 'Track length must be greater than 0'
    }

    if (formData.max_coaches === '' || Number(formData.max_coaches) <= 0) {
      errors.max_coaches = 'Max coaches must be greater than 0'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Submit Add Platform
  const handleCreatePlatform = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm(false)) return

    setIsSubmitting(true)
    setModalError(null)
    try {
      const featuresArr = formData.features
        .split(',')
        .map(f => f.trim())
        .filter(Boolean)

      const payload: PlatformCreatePayload = {
        id: Number(formData.id),
        name: formData.name.trim(),
        status: formData.status,
        type: formData.type,
        length: Number(formData.length),
        max_coaches: Number(formData.max_coaches),
        description: formData.description.trim() || undefined,
        features: featuresArr,
      }

      const created = await api.createPlatform(payload)
      setPlatforms(prev => [...prev, created].sort((a, b) => a.id - b.id))
      setSelectedPlatform(created)
      setShowAddModal(false)
      showNotification(`Platform ${created.id} (${created.name}) created successfully.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create platform'
      setModalError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Edit Platform
  const handleUpdatePlatform = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!platformToEdit) return
    if (!validateForm(true)) return

    setIsSubmitting(true)
    setModalError(null)
    try {
      const featuresArr = formData.features
        .split(',')
        .map(f => f.trim())
        .filter(Boolean)

      const payload: PlatformUpdatePayload = {
        name: formData.name.trim(),
        status: formData.status,
        type: formData.type,
        length: Number(formData.length),
        max_coaches: Number(formData.max_coaches),
        description: formData.description.trim() || undefined,
        features: featuresArr,
      }

      const updated = await api.updatePlatform(platformToEdit.id, payload)
      setPlatforms(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      if (selectedPlatform?.id === updated.id) {
        setSelectedPlatform(updated)
      }
      setShowEditModal(false)
      showNotification(`Platform ${updated.id} updated successfully.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update platform'
      setModalError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Delete Platform
  const handleDeletePlatform = async () => {
    if (!platformToDelete) return
    setIsSubmitting(true)
    setModalError(null)
    try {
      await api.deletePlatform(platformToDelete.id)
      const remaining = platforms.filter(p => p.id !== platformToDelete.id)
      setPlatforms(remaining)
      if (selectedPlatform?.id === platformToDelete.id) {
        setSelectedPlatform(remaining.length > 0 ? remaining[0] : null)
      }
      setShowDeleteDialog(false)
      showNotification(`Platform ${platformToDelete.id} (${platformToDelete.name}) was deleted.`)
      setPlatformToDelete(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete platform'
      setModalError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick Availability Toggle
  const handleToggleAvailability = async (platform: Platform) => {
    const isCurrentlyAvail = (platform.status || '').toUpperCase() === 'AVAILABLE'
    const newStatus = isCurrentlyAvail ? 'OUT_OF_SERVICE' : 'AVAILABLE'
    try {
      const updated = await api.updatePlatform(platform.id, { status: newStatus })
      setPlatforms(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      if (selectedPlatform?.id === updated.id) {
        setSelectedPlatform(updated)
      }
      showNotification(`Platform ${platform.id} status changed to ${newStatus}.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle platform status'
      setError(msg)
    }
  }

  // Count metrics
  const availableCount = platforms.filter(p => (p.status || '').toUpperCase() === 'AVAILABLE').length
  const occupiedCount = platforms.filter(p => (p.status || '').toUpperCase() === 'OCCUPIED').length
  const reservedCount = platforms.filter(p => (p.status || '').toUpperCase() === 'RESERVED').length
  const outOfServiceCount = platforms.filter(p => (p.status || '').toUpperCase() === 'OUT_OF_SERVICE').length

  const getStatusIconColor = (status: string) => {
    const clean = (status || '').toUpperCase()
    if (clean === 'AVAILABLE') return 'bg-rail-green/15 text-rail-green'
    if (clean === 'OCCUPIED') return 'bg-rail-amber/15 text-rail-amber'
    if (clean === 'RESERVED') return 'bg-rail-blue/15 text-rail-blue'
    return 'bg-zinc-800 text-zinc-400'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Management</h1>
          <p className="mt-1 text-sm text-rail-muted">
            Track inventory, berthing allocations, and availability controls
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-rail-orange px-3.5 py-2 text-xs font-semibold text-white hover:bg-rail-orange-dark transition-colors shadow-sm"
          >
            <Plus size={15} />
            <span>Add Platform</span>
          </button>

          <button
            onClick={loadPlatforms}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs font-medium text-rail-muted hover:text-white hover:bg-rail-surface/80 transition-colors disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="flex rounded-lg border border-rail-border bg-rail-surface p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'cards' ? 'bg-rail-charcoal text-white' : 'text-rail-muted hover:text-white'
              }`}
              title="Cards view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'table' ? 'bg-rail-charcoal text-white' : 'text-rail-muted hover:text-white'
              }`}
              title="Table view"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-rail-green/30 bg-rail-green/10 p-3.5 text-xs text-rail-green animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="rounded p-1 hover:bg-rail-green/20">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rail-red/30 bg-rail-red/10 p-4 text-xs text-rail-red">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadPlatforms}
            className="rounded-lg bg-rail-red/20 px-3 py-1 font-semibold hover:bg-rail-red/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-rail-border bg-rail-charcoal p-3.5 text-center">
          <p className="text-2xl font-bold text-white">{loading ? '...' : platforms.length}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Total Platforms</p>
        </div>
        <div className="rounded-xl border border-rail-green/30 bg-rail-green/5 p-3.5 text-center">
          <p className="text-2xl font-bold text-rail-green">{loading ? '...' : availableCount}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Available</p>
        </div>
        <div className="rounded-xl border border-rail-amber/30 bg-rail-amber/5 p-3.5 text-center">
          <p className="text-2xl font-bold text-rail-amber">{loading ? '...' : occupiedCount}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Occupied</p>
        </div>
        <div className="rounded-xl border border-rail-blue/30 bg-rail-blue/5 p-3.5 text-center">
          <p className="text-2xl font-bold text-rail-blue">{loading ? '...' : reservedCount}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Reserved</p>
        </div>
        <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/15 p-3.5 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-zinc-300">{loading ? '...' : outOfServiceCount}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Out of Service</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-rail-border bg-rail-surface px-3 py-2 flex-1 min-w-[220px] max-w-md">
          <Search size={14} className="text-rail-muted" />
          <input
            type="text"
            placeholder="Search by name, number, type, or berthed train..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-xs text-white placeholder:text-rail-muted outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-rail-muted hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-rail-muted hover:text-white transition-colors"
          >
            <Filter size={14} />
            <span>
              {filterStatus === 'all'
                ? 'All Statuses'
                : filterStatus === 'OUT_OF_SERVICE'
                ? 'Out of Service'
                : filterStatus.toLowerCase()}
            </span>
            <ChevronDown size={12} />
          </button>
          {showFilterDropdown && (
            <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-rail-border bg-rail-charcoal py-1 shadow-xl">
              {(
                [
                  { id: 'all', label: 'All Statuses' },
                  { id: 'AVAILABLE', label: 'Available' },
                  { id: 'OCCUPIED', label: 'Occupied' },
                  { id: 'RESERVED', label: 'Reserved' },
                  { id: 'OUT_OF_SERVICE', label: 'Out of Service' },
                ] as const
              ).map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setFilterStatus(item.id as FilterStatus)
                    setShowFilterDropdown(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                    filterStatus === item.id
                      ? 'text-rail-orange bg-rail-orange/10 font-semibold'
                      : 'text-rail-muted hover:text-white hover:bg-rail-surface'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-rail-muted">
          {loading ? 'Loading...' : `${filtered.length} of ${platforms.length} platforms shown`}
        </p>
      </div>

      {/* Main Layout: Cards/Table + Detail Inspector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Platform List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-rail-border bg-rail-charcoal p-4" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-rail-border bg-rail-charcoal p-12 text-center">
              <Layers size={36} className="mx-auto text-rail-muted/60 mb-3" />
              <p className="text-sm font-semibold text-white">No platforms match your criteria</p>
              <p className="text-xs text-rail-muted mt-1 max-w-sm mx-auto">
                {platforms.length === 0
                  ? 'No platforms are currently registered in SQLite. Add your first platform to begin.'
                  : 'Try adjusting your search terms or clearing the status filter.'}
              </p>
              {platforms.length === 0 ? (
                <button
                  onClick={openAddModal}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rail-orange px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rail-orange-dark transition-colors"
                >
                  <Plus size={14} />
                  <span>Add First Platform</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSearch('')
                    setFilterStatus('all')
                  }}
                  className="mt-4 text-xs font-medium text-rail-orange hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            /* Cards View */
            <div className="space-y-3">
              {filtered.map(p => {
                const isSelected = selectedPlatform?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlatform(p)}
                    className={`cursor-pointer rounded-xl border bg-rail-charcoal p-4 transition-all hover:border-rail-muted/50 ${
                      isSelected ? 'border-rail-orange/70 ring-1 ring-rail-orange/30 shadow-md' : 'border-rail-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${getStatusIconColor(
                            p.status
                          )}`}
                        >
                          {p.id}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">{p.name}</p>
                            <StatusBadge status={p.status} size="sm" />
                          </div>
                          <p className="text-xs text-rail-muted mt-0.5">
                            {p.type} Platform · {p.length}m track · {p.max_coaches || 20} coaches
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedPlatform(p)}
                          className="rounded-lg p-1.5 text-rail-muted hover:bg-rail-surface hover:text-white transition-colors"
                          title="View Platform details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="rounded-lg p-1.5 text-rail-muted hover:bg-rail-surface hover:text-white transition-colors"
                          title="Edit Platform"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(p)}
                          className="rounded-lg p-1.5 text-rail-muted hover:bg-rail-red/20 hover:text-rail-red transition-colors"
                          title="Delete Platform"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleAvailability(p)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            (p.status || '').toUpperCase() === 'AVAILABLE'
                              ? 'border border-zinc-700/50 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800'
                              : 'border border-rail-green/30 bg-rail-green/10 text-rail-green hover:bg-rail-green/20'
                          }`}
                          title="Quick toggle operational availability"
                        >
                          {(p.status || '').toUpperCase() === 'AVAILABLE' ? 'Take Out of Service' : 'Set Available'}
                        </button>
                      </div>
                    </div>

                    {p.description && (
                      <p className="mt-2.5 text-xs text-rail-muted line-clamp-1 border-t border-rail-border/40 pt-2">
                        {p.description}
                      </p>
                    )}

                    {p.assignedTrain && (
                      <div className="mt-2.5 flex items-center gap-3 rounded-lg bg-rail-surface px-3 py-2 text-xs">
                        <Train size={13} className="text-rail-orange shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-white">{p.trainName || 'Train'}</span>
                          <span className="text-rail-muted ml-1.5">({p.assignedTrain})</span>
                        </div>
                        <div className="text-right text-[11px] text-rail-muted flex items-center gap-2">
                          {p.arrivalTime && <span>Arr: {p.arrivalTime}</span>}
                          {p.departureTime && <span>Dep: {p.departureTime}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* Table View */
            <div className="rounded-xl border border-rail-border bg-rail-charcoal overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-rail-border bg-rail-surface/60 text-rail-muted">
                      <th className="px-3.5 py-3 font-semibold">ID</th>
                      <th className="px-3.5 py-3 font-semibold">Name</th>
                      <th className="px-3.5 py-3 font-semibold">Status</th>
                      <th className="px-3.5 py-3 font-semibold">Type</th>
                      <th className="px-3.5 py-3 font-semibold">Length</th>
                      <th className="px-3.5 py-3 font-semibold">Max Coaches</th>
                      <th className="px-3.5 py-3 font-semibold">Berthed Train</th>
                      <th className="px-3.5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rail-border/50">
                    {filtered.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedPlatform(p)}
                        className={`cursor-pointer transition-colors hover:bg-rail-surface/40 ${
                          selectedPlatform?.id === p.id ? 'bg-rail-surface/60' : ''
                        }`}
                      >
                        <td className="px-3.5 py-3 font-mono font-bold text-rail-orange">{p.id}</td>
                        <td className="px-3.5 py-3 font-medium text-white">{p.name}</td>
                        <td className="px-3.5 py-3">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-3.5 py-3 text-rail-muted">{p.type}</td>
                        <td className="px-3.5 py-3 text-white">{p.length}m</td>
                        <td className="px-3.5 py-3 text-rail-muted">{p.max_coaches || 20}</td>
                        <td className="px-3.5 py-3 text-rail-muted">
                          {p.assignedTrain ? `${p.trainName || 'Train'} (${p.assignedTrain})` : '—'}
                        </td>
                        <td className="px-3.5 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedPlatform(p)}
                              className="rounded p-1 text-rail-muted hover:text-white"
                              title="View"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => openEditModal(p)}
                              className="rounded p-1 text-rail-muted hover:text-white"
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => openDeleteDialog(p)}
                              className="rounded p-1 text-rail-muted hover:text-rail-red"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Platform Details Panel */}
        <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5 h-fit sticky top-6">
          {selectedPlatform ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-rail-border pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-rail-orange bg-rail-surface px-1.5 py-0.5 rounded">
                      PF #{selectedPlatform.id}
                    </span>
                    <h2 className="text-lg font-bold text-white">{selectedPlatform.name}</h2>
                  </div>
                  <p className="text-xs text-rail-muted mt-0.5">{selectedPlatform.type} platform classification</p>
                </div>
                <StatusBadge status={selectedPlatform.status} size="md" />
              </div>

              {selectedPlatform.description ? (
                <div className="rounded-lg bg-rail-surface/60 p-3 text-xs text-zinc-300 leading-relaxed border border-rail-border/60">
                  <p className="text-[10px] font-semibold text-rail-muted uppercase tracking-wider mb-1">
                    Description & Operating Notes
                  </p>
                  <p>{selectedPlatform.description}</p>
                </div>
              ) : (
                <div className="rounded-lg bg-rail-surface/40 p-2.5 text-xs text-rail-muted italic border border-rail-border/40">
                  No operational description provided.
                </div>
              )}

              <div className="space-y-2.5">
                <DetailRow icon={Layers} label="Track Type" value={selectedPlatform.type} />
                <DetailRow icon={Ruler} label="Usable Length" value={`${selectedPlatform.length} meters`} />
                <DetailRow icon={Train} label="Max Capacity" value={`${selectedPlatform.max_coaches || 20} coaches`} />
                <DetailRow icon={CheckCircle} label="Status" value={selectedPlatform.status.replace(/[-_]/g, ' ')} />

                {selectedPlatform.assignedTrain && (
                  <>
                    <DetailRow
                      icon={Train}
                      label="Berthed Rake"
                      value={`${selectedPlatform.trainName || 'Train'} (${selectedPlatform.assignedTrain})`}
                    />
                    {selectedPlatform.arrivalTime && (
                      <DetailRow icon={Clock} label="Arrival" value={selectedPlatform.arrivalTime} />
                    )}
                    {selectedPlatform.departureTime && (
                      <DetailRow icon={Clock} label="Departure" value={selectedPlatform.departureTime} />
                    )}
                  </>
                )}

                {selectedPlatform.createdDate && (
                  <DetailRow
                    icon={Calendar}
                    label="Registered"
                    value={new Date(selectedPlatform.createdDate).toLocaleDateString()}
                  />
                )}
                {selectedPlatform.updatedDate && (
                  <DetailRow
                    icon={Calendar}
                    label="Last Updated"
                    value={new Date(selectedPlatform.updatedDate).toLocaleDateString()}
                  />
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-rail-muted mb-2">Track & Platform Equipment</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPlatform.features && selectedPlatform.features.length > 0 ? (
                    selectedPlatform.features.map(f => (
                      <span
                        key={f}
                        className="rounded-md bg-rail-surface px-2.5 py-1 text-[11px] text-zinc-300 border border-rail-border"
                      >
                        {f}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-rail-muted">Standard track amenities</span>
                  )}
                </div>
              </div>

              {/* Action Buttons in Inspect Panel */}
              <div className="pt-2 border-t border-rail-border flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(selectedPlatform)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-rail-border bg-rail-surface py-2 text-xs font-semibold text-white hover:bg-rail-surface/80 transition-colors"
                  >
                    <Edit2 size={13} />
                    <span>Edit Platform</span>
                  </button>
                  <button
                    onClick={() => openDeleteDialog(selectedPlatform)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-rail-red/30 bg-rail-red/10 px-3 py-2 text-xs font-semibold text-rail-red hover:bg-rail-red/20 transition-colors"
                    title="Delete Platform"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>

                <button
                  onClick={() => handleToggleAvailability(selectedPlatform)}
                  className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
                    (selectedPlatform.status || '').toUpperCase() === 'AVAILABLE'
                      ? 'border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-rail-green text-white hover:bg-rail-green/90'
                  }`}
                >
                  {(selectedPlatform.status || '').toUpperCase() === 'AVAILABLE'
                    ? 'Take Out of Service'
                    : 'Mark as Available'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle size={36} className="text-rail-muted/50 mb-3" />
              <p className="text-sm font-medium text-white">No platform selected</p>
              <p className="text-xs text-rail-muted mt-1 max-w-[200px]">
                Click on any platform card or row to inspect configuration and status.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* ADD PLATFORM MODAL */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-rail-border bg-rail-charcoal p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-rail-border pb-3.5 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Add New Platform</h2>
                <p className="text-xs text-rail-muted mt-0.5">Register a new track at Itarsi Junction</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-rail-muted hover:text-white hover:bg-rail-surface transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-lg border border-rail-red/30 bg-rail-red/10 p-3 text-xs text-rail-red flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePlatform} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Platform Number / ID <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.id}
                    onChange={e => setFormData({ ...formData, id: e.target.value ? Number(e.target.value) : '' })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.id ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                    placeholder="e.g., 9"
                  />
                  {formErrors.id && <p className="text-[10px] text-rail-red mt-1">{formErrors.id}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Platform Name <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.name ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                    placeholder="e.g., Platform 9"
                  />
                  {formErrors.name && <p className="text-[10px] text-rail-red mt-1">{formErrors.name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="AVAILABLE" className="bg-rail-charcoal">AVAILABLE</option>
                    <option value="OCCUPIED" className="bg-rail-charcoal">OCCUPIED</option>
                    <option value="RESERVED" className="bg-rail-charcoal">RESERVED</option>
                    <option value="OUT_OF_SERVICE" className="bg-rail-charcoal">OUT_OF_SERVICE</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Track Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="Main" className="bg-rail-charcoal">Main Line</option>
                    <option value="Through" className="bg-rail-charcoal">Through Line</option>
                    <option value="Bay" className="bg-rail-charcoal">Bay Platform</option>
                    <option value="Goods" className="bg-rail-charcoal">Goods Siding</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Track Length (meters) <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="1500"
                    value={formData.length}
                    onChange={e => setFormData({ ...formData, length: e.target.value ? Number(e.target.value) : '' })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.length ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                    placeholder="e.g., 550"
                  />
                  {formErrors.length && <p className="text-[10px] text-rail-red mt-1">{formErrors.length}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Max Coach Capacity <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.max_coaches}
                    onChange={e =>
                      setFormData({ ...formData, max_coaches: e.target.value ? Number(e.target.value) : '' })
                    }
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.max_coaches ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                    placeholder="e.g., 22"
                  />
                  {formErrors.max_coaches && (
                    <p className="text-[10px] text-rail-red mt-1">{formErrors.max_coaches}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-rail-muted block mb-1">Features & Amenities</label>
                <input
                  type="text"
                  value={formData.features}
                  onChange={e => setFormData({ ...formData, features: e.target.value })}
                  className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  placeholder="Comma-separated: Covered, Display Board, Waiting Room, Escalator"
                />
                <p className="text-[10px] text-rail-muted mt-0.5">Separate amenities with commas</p>
              </div>

              <div>
                <label className="text-xs font-medium text-rail-muted block mb-1">Description / Operational Notes</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  placeholder="Optional operational details, rake restrictions, or speed limits..."
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-rail-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-lg border border-rail-border bg-rail-surface py-2 text-xs font-medium text-rail-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-rail-orange py-2 text-xs font-semibold text-white hover:bg-rail-orange-dark transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Platform'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EDIT PLATFORM MODAL */}
      {/* ========================================================= */}
      {showEditModal && platformToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-rail-border bg-rail-charcoal p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-rail-border pb-3.5 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Edit Platform {platformToEdit.id}</h2>
                <p className="text-xs text-rail-muted mt-0.5">Update configuration details and availability</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1.5 text-rail-muted hover:text-white hover:bg-rail-surface transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-lg border border-rail-red/30 bg-rail-red/10 p-3 text-xs text-rail-red flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePlatform} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Platform ID</label>
                  <input
                    type="text"
                    disabled
                    value={`Platform #${platformToEdit.id}`}
                    className="w-full rounded-lg border border-rail-border/60 bg-rail-surface/40 px-3 py-2 text-xs text-rail-muted cursor-not-allowed"
                  />
                  <p className="text-[10px] text-rail-muted mt-0.5">ID cannot be modified</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Platform Name <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.name ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                  />
                  {formErrors.name && <p className="text-[10px] text-rail-red mt-1">{formErrors.name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="AVAILABLE" className="bg-rail-charcoal">AVAILABLE</option>
                    <option value="OCCUPIED" className="bg-rail-charcoal">OCCUPIED</option>
                    <option value="RESERVED" className="bg-rail-charcoal">RESERVED</option>
                    <option value="OUT_OF_SERVICE" className="bg-rail-charcoal">OUT_OF_SERVICE</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Track Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="Main" className="bg-rail-charcoal">Main Line</option>
                    <option value="Through" className="bg-rail-charcoal">Through Line</option>
                    <option value="Bay" className="bg-rail-charcoal">Bay Platform</option>
                    <option value="Goods" className="bg-rail-charcoal">Goods Siding</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Track Length (m)</label>
                  <input
                    type="number"
                    min="50"
                    max="1500"
                    value={formData.length}
                    onChange={e => setFormData({ ...formData, length: e.target.value ? Number(e.target.value) : '' })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.length ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                  />
                  {formErrors.length && <p className="text-[10px] text-rail-red mt-1">{formErrors.length}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Max Coaches</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.max_coaches}
                    onChange={e =>
                      setFormData({ ...formData, max_coaches: e.target.value ? Number(e.target.value) : '' })
                    }
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.max_coaches ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                  />
                  {formErrors.max_coaches && (
                    <p className="text-[10px] text-rail-red mt-1">{formErrors.max_coaches}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-rail-muted block mb-1">Features & Amenities</label>
                <input
                  type="text"
                  value={formData.features}
                  onChange={e => setFormData({ ...formData, features: e.target.value })}
                  className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-rail-muted block mb-1">Description / Operational Notes</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-rail-border">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-lg border border-rail-border bg-rail-surface py-2 text-xs font-medium text-rail-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-rail-orange py-2 text-xs font-semibold text-white hover:bg-rail-orange-dark transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Update Platform'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION DIALOG */}
      {/* ========================================================= */}
      {showDeleteDialog && platformToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rail-border bg-rail-charcoal p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rail-red mb-3">
              <div className="rounded-full bg-rail-red/10 p-2.5 border border-rail-red/20">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Platform</h3>
                <p className="text-xs text-rail-muted">Confirm track removal from SQLite database</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              Are you sure you want to delete <span className="font-semibold text-white">{platformToDelete.name}</span>{' '}
              (Track #{platformToDelete.id})? This will permanently delete the platform record.
            </p>

            <div className="rounded-lg bg-rail-surface/70 border border-rail-border p-3 text-[11px] text-rail-muted space-y-1 mb-4">
              <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                <Info size={12} className="text-rail-orange" />
                <span>Safety Guardrails Active</span>
              </div>
              <p>Deletion will be rejected if active train berths or pending allocation records exist.</p>
            </div>

            {modalError && (
              <div className="mb-4 rounded-lg border border-rail-red/30 bg-rail-red/10 p-3 text-xs text-rail-red flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isSubmitting}
                className="flex-1 rounded-lg border border-rail-border bg-rail-surface py-2 text-xs font-medium text-rail-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePlatform}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-rail-red py-2 text-xs font-semibold text-white hover:bg-rail-red/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Platform'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-rail-surface px-3 py-2">
      <Icon size={14} className="text-rail-muted shrink-0" />
      <span className="text-xs text-rail-muted w-24 shrink-0">{label}</span>
      <span className="text-xs text-white capitalize truncate">{value}</span>
    </div>
  )
}
