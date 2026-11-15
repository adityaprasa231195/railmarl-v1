import { useState, useEffect, useCallback } from 'react'
import {
  Search, Filter, Plus, Eye, Edit2, Trash2, Train, Clock,
  ChevronDown, X, ArrowUpDown, Layers, RefreshCw, AlertTriangle,
  CheckCircle, Moon, Info, Calendar, Globe
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { api, type TrainCreatePayload, type TrainUpdatePayload } from '../services/api'
import type { Train as TrainType, Platform } from '../data/mockData'

type SortField = 'name' | 'number' | 'arrivalTime' | 'departureTime' | 'status' | 'platform'
type CategoryFilter = 'all' | 'SUPERFAST' | 'EXPRESS' | 'PASSENGER' | 'FREIGHT' | 'OTHER'
type StatusFilter = 'all' | 'SCHEDULED' | 'APPROACHING' | 'ARRIVED' | 'DEPARTED' | 'CANCELLED' | 'DELAYED'

interface FormErrors {
  number?: string
  name?: string
  origin?: string
  destination?: string
  arrivalTime?: string
  departureTime?: string
  coaches?: string
  platform?: string
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export default function TrainManagement() {
  const [trains, setTrains] = useState<TrainType[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Filters & Sorting
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('arrivalTime')
  const [sortAsc, setSortAsc] = useState(true)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  // Modals
  const [viewTrain, setViewTrain] = useState<TrainType | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [trainToEdit, setTrainToEdit] = useState<TrainType | null>(null)
  const [trainToDelete, setTrainToDelete] = useState<TrainType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState<{
    number: string
    name: string
    category: string
    origin: string
    destination: string
    arrivalTime: string
    departureTime: string
    isOvernight: boolean
    platform: number | ''
    status: string
    delay: number | ''
    coaches: number | ''
    priority: string
    description: string
  }>({
    number: '',
    name: '',
    category: 'EXPRESS',
    origin: '',
    destination: '',
    arrivalTime: '',
    departureTime: '',
    isOvernight: false,
    platform: '',
    status: 'SCHEDULED',
    delay: 0,
    coaches: 18,
    priority: 'MEDIUM',
    description: '',
  })
  const [formErrors, setFormErrors] = useState<FormErrors>({})

  const showNotification = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => {
      setSuccessMsg(null)
    }, 4500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [trainsData, platformsData] = await Promise.all([
        api.getTrains(),
        api.getPlatforms(),
      ])
      setTrains(trainsData)
      setPlatforms(platformsData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch train records'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter & Sort Logic
  const filtered = trains
    .filter(t => {
      const searchLower = search.toLowerCase().trim()
      const matchesSearch =
        !searchLower ||
        t.name.toLowerCase().includes(searchLower) ||
        t.number.toLowerCase().includes(searchLower) ||
        t.origin.toLowerCase().includes(searchLower) ||
        t.destination.toLowerCase().includes(searchLower)

      const tCatNormalized = (t.category || '').toUpperCase()
      const matchesCat =
        categoryFilter === 'all' ||
        tCatNormalized === categoryFilter ||
        (categoryFilter === 'EXPRESS' && tCatNormalized === 'MAIL')

      const tStatusNormalized = (t.status || '').toUpperCase().replace('-', '_')
      const matchesStatus =
        statusFilter === 'all' ||
        tStatusNormalized === statusFilter ||
        (statusFilter === 'SCHEDULED' && tStatusNormalized === 'ON_TIME') ||
        (statusFilter === 'DELAYED' && ((t.delay ?? 0) > 0 || tStatusNormalized === 'DELAYED'))

      return matchesSearch && matchesCat && matchesStatus
    })
    .sort((a, b) => {
      let av: string | number = a[sortField] ?? ''
      let bv: string | number = b[sortField] ?? ''
      if (sortField === 'platform') {
        av = a.platform ?? 999
        bv = b.platform ?? 999
        return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
      }
      const cmp = String(av).localeCompare(String(bv))
      return sortAsc ? cmp : -cmp
    })

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-semibold text-rail-muted hover:text-white transition-colors"
    >
      {children}
      <ArrowUpDown size={11} className={sortField === field ? 'text-rail-orange' : 'opacity-40'} />
    </button>
  )

  // Open Add Modal
  const openAddModal = () => {
    setFormData({
      number: '',
      name: '',
      category: 'EXPRESS',
      origin: '',
      destination: '',
      arrivalTime: '12:00',
      departureTime: '12:15',
      isOvernight: false,
      platform: '',
      status: 'SCHEDULED',
      delay: 0,
      coaches: 18,
      priority: 'MEDIUM',
      description: '',
    })
    setFormErrors({})
    setModalError(null)
    setShowAddModal(true)
  }

  // Open Edit Modal
  const openEditModal = (t: TrainType) => {
    setTrainToEdit(t)
    setFormData({
      number: t.number,
      name: t.name,
      category: (t.category || 'EXPRESS').toUpperCase(),
      origin: t.origin,
      destination: t.destination,
      arrivalTime: t.arrivalTime,
      departureTime: t.departureTime,
      isOvernight: Boolean(t.isOvernight),
      platform: t.platform ?? '',
      status: (t.status || 'SCHEDULED').toUpperCase().replace('-', '_'),
      delay: t.delay ?? 0,
      coaches: t.coaches ?? 18,
      priority: (t.priority || 'MEDIUM').toUpperCase(),
      description: t.description || '',
    })
    setFormErrors({})
    setModalError(null)
    setShowEditModal(true)
  }

  // Open Delete Confirmation
  const openDeleteDialog = (t: TrainType) => {
    setTrainToDelete(t)
    setModalError(null)
    setShowDeleteDialog(true)
  }

  // Form Validation
  const validateForm = (isEdit = false): boolean => {
    const errors: FormErrors = {}

    if (!formData.number.trim()) {
      errors.number = 'Train number is required'
    } else if (
      trains.some(
        t => t.number.toLowerCase() === formData.number.trim().toLowerCase() && (!isEdit || t.id !== trainToEdit?.id)
      )
    ) {
      errors.number = `Train number '${formData.number}' already exists in database`
    }

    if (!formData.name.trim()) {
      errors.name = 'Train name is required'
    }

    if (!formData.origin.trim()) {
      errors.origin = 'Origin station is required'
    }

    if (!formData.destination.trim()) {
      errors.destination = 'Destination station is required'
    }

    if (!formData.arrivalTime.trim()) {
      errors.arrivalTime = 'Arrival time is required'
    } else if (!TIME_REGEX.test(formData.arrivalTime.trim())) {
      errors.arrivalTime = 'Must be HH:MM in 24-hr format (e.g. 14:30)'
    }

    if (!formData.departureTime.trim()) {
      errors.departureTime = 'Departure time is required'
    } else if (!TIME_REGEX.test(formData.departureTime.trim())) {
      errors.departureTime = 'Must be HH:MM in 24-hr format (e.g. 14:45)'
    } else if (!formData.isOvernight && formData.arrivalTime && formData.departureTime < formData.arrivalTime) {
      errors.departureTime = 'Departure cannot be earlier than arrival on same day (enable Overnight)'
    }

    if (formData.coaches === '' || Number(formData.coaches) <= 0) {
      errors.coaches = 'Coaches must be greater than 0'
    }

    // Platform validation
    if (formData.platform !== '') {
      const selectedP = platforms.find(p => p.id === Number(formData.platform))
      if (!selectedP) {
        errors.platform = `Platform ${formData.platform} does not exist`
      } else if ((selectedP.status || '').toUpperCase() === 'OUT_OF_SERVICE') {
        errors.platform = `Platform ${formData.platform} is currently OUT OF SERVICE. Cannot assign trains.`
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Submit Add Train
  const handleCreateTrain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm(false)) return

    setIsSubmitting(true)
    setModalError(null)
    try {
      const payload: TrainCreatePayload = {
        number: formData.number.trim(),
        name: formData.name.trim(),
        category: formData.category,
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        arrivalTime: formData.arrivalTime.trim(),
        departureTime: formData.departureTime.trim(),
        isOvernight: formData.isOvernight,
        platform: formData.platform !== '' ? Number(formData.platform) : null,
        status: formData.status,
        delay: formData.delay !== '' ? Number(formData.delay) : 0,
        coaches: Number(formData.coaches),
        priority: formData.priority,
        description: formData.description.trim() || undefined,
      }

      const created = await api.createTrain(payload)
      setTrains(prev => [...prev, created].sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime)))
      setShowAddModal(false)
      showNotification(`Train ${created.number} (${created.name}) added to schedule.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add train'
      setModalError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Edit Train
  const handleUpdateTrain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trainToEdit) return
    if (!validateForm(true)) return

    setIsSubmitting(true)
    setModalError(null)
    try {
      const payload: TrainUpdatePayload = {
        number: formData.number.trim(),
        name: formData.name.trim(),
        category: formData.category,
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        arrivalTime: formData.arrivalTime.trim(),
        departureTime: formData.departureTime.trim(),
        isOvernight: formData.isOvernight,
        platform: formData.platform !== '' ? Number(formData.platform) : 0,
        status: formData.status,
        delay: formData.delay !== '' ? Number(formData.delay) : 0,
        coaches: Number(formData.coaches),
        priority: formData.priority,
        description: formData.description.trim() || undefined,
      }

      const updated = await api.updateTrain(trainToEdit.id, payload)
      setTrains(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      if (viewTrain?.id === updated.id) {
        setViewTrain(updated)
      }
      setShowEditModal(false)
      showNotification(`Train ${updated.number} (${updated.name}) updated successfully.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update train'
      setModalError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit Delete Train
  const handleDeleteTrain = async () => {
    if (!trainToDelete) return
    setIsSubmitting(true)
    setModalError(null)
    try {
      await api.deleteTrain(trainToDelete.id)
      setTrains(prev => prev.filter(t => t.id !== trainToDelete.id))
      if (viewTrain?.id === trainToDelete.id) {
        setViewTrain(null)
      }
      setShowDeleteDialog(false)
      showNotification(`Train ${trainToDelete.number} was removed from database.`)
      setTrainToDelete(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete train'
      setModalError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Summary Metrics
  const approachingCount = trains.filter(t => (t.status || '').toUpperCase() === 'APPROACHING').length
  const arrivedCount = trains.filter(t => (t.status || '').toUpperCase() === 'ARRIVED').length
  const scheduledCount = trains.filter(
    t => (t.status || '').toUpperCase() === 'SCHEDULED' || (t.status || '').toLowerCase() === 'on-time'
  ).length
  const delayedCount = trains.filter(
    t => (t.status || '').toUpperCase() === 'DELAYED' || (t.delay ?? 0) > 0
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Train Management</h1>
          <p className="mt-1 text-sm text-rail-muted">
            Timetables, rake categories, platform references, and operational statuses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/settings"
            className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition-colors shadow-sm"
            title="Import live and scheduled trains from external Indian Railway API"
          >
            <Globe size={14} />
            <span>Import via Railway API</span>
          </a>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-rail-orange px-3.5 py-2 text-xs font-semibold text-white hover:bg-rail-orange-dark transition-colors shadow-sm"
          >
            <Plus size={15} />
            <span>Add Train</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs font-medium text-rail-muted hover:text-white hover:bg-rail-surface/80 transition-colors disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
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
            onClick={loadData}
            className="rounded-lg bg-rail-red/20 px-3 py-1 font-semibold hover:bg-rail-red/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-rail-border bg-rail-charcoal p-3.5 text-center">
          <p className="text-2xl font-bold text-white">{loading ? '...' : trains.length}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Total Trains</p>
        </div>
        <div className="rounded-xl border border-rail-blue/30 bg-rail-blue/5 p-3.5 text-center">
          <p className="text-2xl font-bold text-rail-blue">{loading ? '...' : scheduledCount}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Scheduled</p>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3.5 text-center">
          <p className="text-2xl font-bold text-cyan-400">{loading ? '...' : approachingCount}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Approaching</p>
        </div>
        <div className="rounded-xl border border-rail-green/30 bg-rail-green/5 p-3.5 text-center">
          <p className="text-2xl font-bold text-rail-green">{loading ? '...' : arrivedCount}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Berthed / Arrived</p>
        </div>
        <div className="rounded-xl border border-rail-red/30 bg-rail-red/5 p-3.5 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-rail-red">{loading ? '...' : delayedCount}</p>
          <p className="text-[11px] text-rail-muted mt-1 uppercase tracking-wider">Delayed</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-rail-border bg-rail-surface px-3 py-2 flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="text-rail-muted" />
          <input
            type="text"
            placeholder="Search by number, name, origin, or destination..."
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

        {/* Category Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowCategoryDropdown(!showCategoryDropdown)
              setShowStatusDropdown(false)
            }}
            className="flex items-center gap-2 rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-rail-muted hover:text-white transition-colors"
          >
            <Filter size={14} />
            <span>
              {categoryFilter === 'all'
                ? 'All Categories'
                : categoryFilter.charAt(0) + categoryFilter.slice(1).toLowerCase()}
            </span>
            <ChevronDown size={12} />
          </button>
          {showCategoryDropdown && (
            <div className="absolute left-0 top-full mt-1 z-20 w-44 rounded-lg border border-rail-border bg-rail-charcoal py-1 shadow-xl">
              {(
                [
                  { id: 'all', label: 'All Categories' },
                  { id: 'SUPERFAST', label: 'Superfast' },
                  { id: 'EXPRESS', label: 'Express' },
                  { id: 'PASSENGER', label: 'Passenger' },
                  { id: 'FREIGHT', label: 'Freight' },
                  { id: 'OTHER', label: 'Other' },
                ] as const
              ).map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCategoryFilter(c.id as CategoryFilter)
                    setShowCategoryDropdown(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                    categoryFilter === c.id
                      ? 'text-rail-orange bg-rail-orange/10 font-semibold'
                      : 'text-rail-muted hover:text-white hover:bg-rail-surface'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowStatusDropdown(!showStatusDropdown)
              setShowCategoryDropdown(false)
            }}
            className="flex items-center gap-2 rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-rail-muted hover:text-white transition-colors"
          >
            <Clock size={14} />
            <span>
              {statusFilter === 'all'
                ? 'All Statuses'
                : statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()}
            </span>
            <ChevronDown size={12} />
          </button>
          {showStatusDropdown && (
            <div className="absolute left-0 top-full mt-1 z-20 w-44 rounded-lg border border-rail-border bg-rail-charcoal py-1 shadow-xl">
              {(
                [
                  { id: 'all', label: 'All Statuses' },
                  { id: 'SCHEDULED', label: 'Scheduled' },
                  { id: 'APPROACHING', label: 'Approaching' },
                  { id: 'ARRIVED', label: 'Arrived / Berthed' },
                  { id: 'DEPARTED', label: 'Departed' },
                  { id: 'DELAYED', label: 'Delayed' },
                  { id: 'CANCELLED', label: 'Cancelled' },
                ] as const
              ).map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStatusFilter(s.id as StatusFilter)
                    setShowStatusDropdown(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                    statusFilter === s.id
                      ? 'text-rail-orange bg-rail-orange/10 font-semibold'
                      : 'text-rail-muted hover:text-white hover:bg-rail-surface'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-rail-muted">
          {loading ? 'Loading...' : `${filtered.length} of ${trains.length} trains shown`}
        </p>
      </div>

      {/* Train Data Table */}
      <div className="rounded-xl border border-rail-border bg-rail-charcoal overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-rail-border bg-rail-surface/60 text-rail-muted">
                <th className="px-4 py-3.5"><SortHeader field="number">Number</SortHeader></th>
                <th className="px-4 py-3.5"><SortHeader field="name">Train Name</SortHeader></th>
                <th className="px-4 py-3.5 font-semibold">Category</th>
                <th className="px-4 py-3.5 font-semibold">Route</th>
                <th className="px-4 py-3.5"><SortHeader field="arrivalTime">Arrival</SortHeader></th>
                <th className="px-4 py-3.5"><SortHeader field="departureTime">Departure</SortHeader></th>
                <th className="px-4 py-3.5"><SortHeader field="platform">Assigned Platform</SortHeader></th>
                <th className="px-4 py-3.5"><SortHeader field="status">Status</SortHeader></th>
                <th className="px-4 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rail-border/50">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-4 animate-pulse rounded bg-rail-surface/60" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-xs text-rail-muted">
                    <Train size={36} className="mx-auto text-rail-muted/50 mb-3" />
                    <p className="font-semibold text-white">No trains matching criteria</p>
                    <p className="mt-1 max-w-sm mx-auto">
                      {trains.length === 0
                        ? 'No train records exist in SQLite. Add your first train to populate schedules.'
                        : 'Try adjusting your search query or filters.'}
                    </p>
                    {trains.length === 0 ? (
                      <button
                        onClick={openAddModal}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rail-orange px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rail-orange-dark transition-colors"
                      >
                        <Plus size={14} />
                        <span>Add First Train</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSearch('')
                          setCategoryFilter('all')
                          setStatusFilter('all')
                        }}
                        className="mt-4 text-xs font-medium text-rail-orange hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(t => {
                  const assignedPlat = platforms.find(p => p.id === t.platform)
                  const isOut = assignedPlat && (assignedPlat.status || '').toUpperCase() === 'OUT_OF_SERVICE'

                  return (
                    <tr key={t.id} className="transition-colors hover:bg-rail-surface/40">
                      <td className="px-4 py-3.5 font-mono font-bold text-rail-orange whitespace-nowrap">
                        {t.number}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{t.name}</p>
                          {t.dataSource === 'EXTERNAL_API' && (
                            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              API
                            </span>
                          )}
                          {t.dataSource === 'MANUAL_ENTRY' && (
                            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              Manual
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-rail-muted mt-0.5">{t.coaches} coaches · Priority: {t.priority}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={t.category} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-zinc-300">
                          <span>{t.origin}</span>
                          <span className="text-rail-muted">→</span>
                          <span>{t.destination}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-zinc-200 whitespace-nowrap">
                        {t.arrivalTime}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-zinc-200 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{t.departureTime}</span>
                          {t.isOvernight && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              title="Overnight dwell (departs following calendar day)"
                            >
                              <Moon size={9} />
                              <span>+1d</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {t.platform ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 font-semibold text-white bg-rail-surface px-2 py-0.5 rounded border border-rail-border">
                              <Layers size={11} className="text-rail-orange" />
                              <span>PF {t.platform}</span>
                            </span>
                            {isOut && (
                              <span className="text-[10px] text-rail-red font-semibold">(Track Out of Service)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-rail-muted italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={t.status} />
                          {(t.delay ?? 0) > 0 && (
                            <span className="rounded bg-rail-red/15 px-1.5 py-0.5 text-[10px] font-bold text-rail-red border border-rail-red/30">
                              +{t.delay}m
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewTrain(t)}
                            className="rounded-md p-1.5 text-rail-muted hover:bg-rail-surface hover:text-white transition-colors"
                            title="View Train Details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => openEditModal(t)}
                            className="rounded-md p-1.5 text-rail-muted hover:bg-rail-surface hover:text-white transition-colors"
                            title="Edit Train"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => openDeleteDialog(t)}
                            className="rounded-md p-1.5 text-rail-muted hover:bg-rail-red/20 hover:text-rail-red transition-colors"
                            title="Delete Train"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW TRAIN MODAL */}
      {/* ========================================================= */}
      {viewTrain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-rail-border bg-rail-charcoal p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-rail-border pb-3.5 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-rail-orange bg-rail-surface px-2 py-0.5 rounded border border-rail-border">
                    {viewTrain.number}
                  </span>
                  <h2 className="text-lg font-bold text-white">{viewTrain.name}</h2>
                </div>
                <p className="text-xs text-rail-muted mt-1">
                  {viewTrain.origin} → {viewTrain.destination}
                </p>
              </div>
              <button
                onClick={() => setViewTrain(null)}
                className="rounded-lg p-1.5 text-rail-muted hover:text-white hover:bg-rail-surface transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {viewTrain.description && (
                <div className="rounded-lg bg-rail-surface/60 p-3 text-xs text-zinc-300 border border-rail-border/60">
                  <p className="text-[10px] font-semibold text-rail-muted uppercase tracking-wider mb-1">
                    Operating Description
                  </p>
                  <p>{viewTrain.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <DetailRow icon={Train} label="Category" value={viewTrain.category} />
                <DetailRow icon={Clock} label="Status" value={viewTrain.status} />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <DetailRow icon={Clock} label="Arrival" value={viewTrain.arrivalTime} />
                <DetailRow
                  icon={Clock}
                  label="Departure"
                  value={
                    viewTrain.isOvernight
                      ? `${viewTrain.departureTime} (Overnight +1d)`
                      : viewTrain.departureTime
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <DetailRow
                  icon={Layers}
                  label="Platform"
                  value={
                    viewTrain.platform
                      ? `Platform ${viewTrain.platform} ${viewTrain.platformType ? `(${viewTrain.platformType})` : ''}`
                      : 'Unassigned'
                  }
                />
                <DetailRow
                  icon={AlertTriangle}
                  label="Delay Offset"
                  value={viewTrain.delay ? `+${viewTrain.delay} min` : 'On Time (0 min)'}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <DetailRow icon={Train} label="Rake Coaches" value={`${viewTrain.coaches} coaches`} />
                <DetailRow icon={Info} label="Priority" value={viewTrain.priority} />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <DetailRow
                  icon={Globe}
                  label="Data Source"
                  value={
                    viewTrain.dataSource === 'EXTERNAL_API'
                      ? 'External Railway API'
                      : viewTrain.dataSource === 'MANUAL_ENTRY'
                      ? 'Manual Entry'
                      : 'Demonstration Record'
                  }
                />
                <DetailRow
                  icon={Calendar}
                  label="Last Synced"
                  value={
                    viewTrain.lastSyncedAt
                      ? new Date(viewTrain.lastSyncedAt).toLocaleString()
                      : viewTrain.dataSource === 'EXTERNAL_API'
                      ? 'Recently Synced'
                      : 'Not Synced'
                  }
                />
              </div>

              {viewTrain.createdDate && (
                <DetailRow
                  icon={Calendar}
                  label="Registered"
                  value={new Date(viewTrain.createdDate).toLocaleString()}
                />
              )}
            </div>

            <div className="flex gap-2.5 pt-4 mt-5 border-t border-rail-border">
              <button
                onClick={() => {
                  const t = viewTrain
                  setViewTrain(null)
                  openEditModal(t)
                }}
                className="flex-1 rounded-lg border border-rail-border bg-rail-surface py-2 text-xs font-semibold text-white hover:bg-rail-surface/80 transition-colors"
              >
                Edit Train Details
              </button>
              <button
                onClick={() => setViewTrain(null)}
                className="rounded-lg bg-rail-surface px-5 py-2 text-xs font-medium text-rail-muted hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD TRAIN MODAL */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-rail-border bg-rail-charcoal p-6 shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-rail-border pb-3.5 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Add Train to Schedule</h2>
                <p className="text-xs text-rail-muted mt-0.5">Register a train service at Itarsi Junction</p>
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

            <form onSubmit={handleCreateTrain} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Train Number <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={e => setFormData({ ...formData, number: e.target.value })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.number ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                    placeholder="e.g., 12627"
                  />
                  {formErrors.number && <p className="text-[10px] text-rail-red mt-1">{formErrors.number}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Train Name <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.name ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                    placeholder="e.g., Karnataka Express"
                  />
                  {formErrors.name && <p className="text-[10px] text-rail-red mt-1">{formErrors.name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="SUPERFAST" className="bg-rail-charcoal">SUPERFAST</option>
                    <option value="EXPRESS" className="bg-rail-charcoal">EXPRESS</option>
                    <option value="PASSENGER" className="bg-rail-charcoal">PASSENGER</option>
                    <option value="FREIGHT" className="bg-rail-charcoal">FREIGHT</option>
                    <option value="OTHER" className="bg-rail-charcoal">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Operational Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="SCHEDULED" className="bg-rail-charcoal">SCHEDULED</option>
                    <option value="APPROACHING" className="bg-rail-charcoal">APPROACHING</option>
                    <option value="ARRIVED" className="bg-rail-charcoal">ARRIVED / BERTHED</option>
                    <option value="DEPARTED" className="bg-rail-charcoal">DEPARTED</option>
                    <option value="CANCELLED" className="bg-rail-charcoal">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Origin Station <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={e => setFormData({ ...formData, origin: e.target.value })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.origin ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                    placeholder="e.g., New Delhi"
                  />
                  {formErrors.origin && <p className="text-[10px] text-rail-red mt-1">{formErrors.origin}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Destination Station <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={e => setFormData({ ...formData, destination: e.target.value })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.destination ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                    placeholder="e.g., Bengaluru"
                  />
                  {formErrors.destination && (
                    <p className="text-[10px] text-rail-red mt-1">{formErrors.destination}</p>
                  )}
                </div>
              </div>

              {/* Schedules & Overnight */}
              <div className="rounded-lg border border-rail-border/80 bg-rail-surface/30 p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-rail-muted block mb-1">
                      Scheduled Arrival (HH:MM) <span className="text-rail-orange">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.arrivalTime}
                      onChange={e => setFormData({ ...formData, arrivalTime: e.target.value })}
                      className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none font-mono transition-colors ${
                        formErrors.arrivalTime ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                      }`}
                      placeholder="14:30"
                    />
                    {formErrors.arrivalTime && (
                      <p className="text-[10px] text-rail-red mt-1">{formErrors.arrivalTime}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-rail-muted block mb-1">
                      Scheduled Departure (HH:MM) <span className="text-rail-orange">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.departureTime}
                      onChange={e => setFormData({ ...formData, departureTime: e.target.value })}
                      className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none font-mono transition-colors ${
                        formErrors.departureTime ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                      }`}
                      placeholder="14:45"
                    />
                    {formErrors.departureTime && (
                      <p className="text-[10px] text-rail-red mt-1">{formErrors.departureTime}</p>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formData.isOvernight}
                    onChange={e => setFormData({ ...formData, isOvernight: e.target.checked })}
                    className="rounded border-rail-border text-rail-orange focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300">
                    Overnight dwell (Departure occurs on the following calendar day)
                  </span>
                </label>
              </div>

              {/* Platform & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Assigned Platform</label>
                  <select
                    value={formData.platform}
                    onChange={e =>
                      setFormData({ ...formData, platform: e.target.value ? Number(e.target.value) : '' })
                    }
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.platform ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                  >
                    <option value="" className="bg-rail-charcoal">-- Unassigned (None) --</option>
                    {platforms.map(p => {
                      const isOut = (p.status || '').toUpperCase() === 'OUT_OF_SERVICE'
                      return (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={isOut}
                          className={isOut ? 'bg-rail-charcoal text-zinc-500' : 'bg-rail-charcoal text-white'}
                        >
                          {p.name} ({p.type}) {isOut ? '- OUT OF SERVICE' : ''}
                        </option>
                      )
                    })}
                  </select>
                  {formErrors.platform && (
                    <p className="text-[10px] text-rail-red mt-1">{formErrors.platform}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="HIGH" className="bg-rail-charcoal">HIGH (Mail / Superfast)</option>
                    <option value="MEDIUM" className="bg-rail-charcoal">MEDIUM (Express)</option>
                    <option value="LOW" className="bg-rail-charcoal">LOW (Freight / Shuttle)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Coach Count <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.coaches}
                    onChange={e =>
                      setFormData({ ...formData, coaches: e.target.value ? Number(e.target.value) : '' })
                    }
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.coaches ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                  />
                  {formErrors.coaches && (
                    <p className="text-[10px] text-rail-red mt-1">{formErrors.coaches}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Delay Offset (min)</label>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    value={formData.delay}
                    onChange={e =>
                      setFormData({ ...formData, delay: e.target.value ? Number(e.target.value) : 0 })
                    }
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-rail-muted block mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  placeholder="Special rake composition, pantograph restrictions, commercial stops..."
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
                  {isSubmitting ? 'Adding...' : 'Add Train to Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EDIT TRAIN MODAL */}
      {/* ========================================================= */}
      {showEditModal && trainToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-rail-border bg-rail-charcoal p-6 shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-rail-border pb-3.5 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Edit Train {trainToEdit.number}</h2>
                <p className="text-xs text-rail-muted mt-0.5">{trainToEdit.name}</p>
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

            <form onSubmit={handleUpdateTrain} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Train Number <span className="text-rail-orange">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={e => setFormData({ ...formData, number: e.target.value })}
                    className={`w-full rounded-lg border bg-rail-surface px-3 py-2 text-xs text-white outline-none transition-colors ${
                      formErrors.number ? 'border-rail-red' : 'border-rail-border focus:border-rail-orange'
                    }`}
                  />
                  {formErrors.number && <p className="text-[10px] text-rail-red mt-1">{formErrors.number}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">
                    Train Name <span className="text-rail-orange">*</span>
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
                  <label className="text-xs font-medium text-rail-muted block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="SUPERFAST" className="bg-rail-charcoal">SUPERFAST</option>
                    <option value="EXPRESS" className="bg-rail-charcoal">EXPRESS</option>
                    <option value="PASSENGER" className="bg-rail-charcoal">PASSENGER</option>
                    <option value="FREIGHT" className="bg-rail-charcoal">FREIGHT</option>
                    <option value="OTHER" className="bg-rail-charcoal">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Operational Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="SCHEDULED" className="bg-rail-charcoal">SCHEDULED</option>
                    <option value="APPROACHING" className="bg-rail-charcoal">APPROACHING</option>
                    <option value="ARRIVED" className="bg-rail-charcoal">ARRIVED / BERTHED</option>
                    <option value="DEPARTED" className="bg-rail-charcoal">DEPARTED</option>
                    <option value="CANCELLED" className="bg-rail-charcoal">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Origin Station</label>
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={e => setFormData({ ...formData, origin: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Destination Station</label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={e => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  />
                </div>
              </div>

              {/* Schedules & Overnight */}
              <div className="rounded-lg border border-rail-border/80 bg-rail-surface/30 p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-rail-muted block mb-1">Scheduled Arrival</label>
                    <input
                      type="text"
                      value={formData.arrivalTime}
                      onChange={e => setFormData({ ...formData, arrivalTime: e.target.value })}
                      className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none font-mono focus:border-rail-orange"
                    />
                    {formErrors.arrivalTime && (
                      <p className="text-[10px] text-rail-red mt-1">{formErrors.arrivalTime}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-rail-muted block mb-1">Scheduled Departure</label>
                    <input
                      type="text"
                      value={formData.departureTime}
                      onChange={e => setFormData({ ...formData, departureTime: e.target.value })}
                      className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none font-mono focus:border-rail-orange"
                    />
                    {formErrors.departureTime && (
                      <p className="text-[10px] text-rail-red mt-1">{formErrors.departureTime}</p>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formData.isOvernight}
                    onChange={e => setFormData({ ...formData, isOvernight: e.target.checked })}
                    className="rounded border-rail-border text-rail-orange focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300">
                    Overnight dwell (Departure occurs on following calendar day)
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Assigned Platform</label>
                  <select
                    value={formData.platform}
                    onChange={e =>
                      setFormData({ ...formData, platform: e.target.value ? Number(e.target.value) : '' })
                    }
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="" className="bg-rail-charcoal">-- Unassigned (None) --</option>
                    {platforms.map(p => {
                      const isOut = (p.status || '').toUpperCase() === 'OUT_OF_SERVICE'
                      return (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={isOut && p.id !== trainToEdit.platform}
                          className={isOut ? 'bg-rail-charcoal text-zinc-500' : 'bg-rail-charcoal text-white'}
                        >
                          {p.name} ({p.type}) {isOut ? '- OUT OF SERVICE' : ''}
                        </option>
                      )
                    })}
                  </select>
                  {formErrors.platform && (
                    <p className="text-[10px] text-rail-red mt-1">{formErrors.platform}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Delay (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.delay}
                    onChange={e =>
                      setFormData({ ...formData, delay: e.target.value ? Number(e.target.value) : 0 })
                    }
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Coach Count</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.coaches}
                    onChange={e =>
                      setFormData({ ...formData, coaches: e.target.value ? Number(e.target.value) : '' })
                    }
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-rail-muted block mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full rounded-lg border border-rail-border bg-rail-surface px-3 py-2 text-xs text-white outline-none focus:border-rail-orange"
                  >
                    <option value="HIGH" className="bg-rail-charcoal">HIGH</option>
                    <option value="MEDIUM" className="bg-rail-charcoal">MEDIUM</option>
                    <option value="LOW" className="bg-rail-charcoal">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-rail-muted block mb-1">Description / Notes</label>
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
                  {isSubmitting ? 'Saving...' : 'Update Train'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION DIALOG */}
      {/* ========================================================= */}
      {showDeleteDialog && trainToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rail-border bg-rail-charcoal p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rail-red mb-3">
              <div className="rounded-full bg-rail-red/10 p-2.5 border border-rail-red/20">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Train</h3>
                <p className="text-xs text-rail-muted">Confirm service removal from SQLite schedule</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              Are you sure you want to delete Train{' '}
              <span className="font-semibold text-white">{trainToDelete.number}</span> (
              {trainToDelete.name})? This action removes the timetable record from the system.
            </p>

            <div className="rounded-lg bg-rail-surface/70 border border-rail-border p-3 text-[11px] text-rail-muted space-y-1 mb-4">
              <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                <Info size={12} className="text-rail-orange" />
                <span>Safety Guardrails Active</span>
              </div>
              <p>Deletion will be rejected if active dependent allocation records exist for this service.</p>
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
                onClick={handleDeleteTrain}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-rail-red py-2 text-xs font-semibold text-white hover:bg-rail-red/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Train'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Train; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-rail-surface/70 px-3 py-2">
      <Icon size={13} className="text-rail-muted shrink-0" />
      <span className="text-[11px] text-rail-muted w-24 shrink-0">{label}</span>
      <span className="text-xs text-white capitalize truncate">{value}</span>
    </div>
  )
}
