interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

const statusStyles: Record<string, string> = {
  // Platform & Operation Statuses
  available: 'bg-rail-green/15 text-rail-green border-rail-green/30',
  occupied: 'bg-rail-amber/15 text-rail-amber border-rail-amber/30',
  reserved: 'bg-rail-blue/15 text-rail-blue border-rail-blue/30',
  out_of_service: 'bg-zinc-700/25 text-zinc-300 border-zinc-600/40',
  'out-of-service': 'bg-zinc-700/25 text-zinc-300 border-zinc-600/40',

  // Train Operational Statuses
  scheduled: 'bg-rail-blue/15 text-rail-blue border-rail-blue/30',
  approaching: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  arrived: 'bg-rail-green/15 text-rail-green border-rail-green/30',
  departed: 'bg-zinc-700/25 text-zinc-400 border-zinc-700/40',
  cancelled: 'bg-rail-red/15 text-rail-red border-rail-red/30',
  'on-time': 'bg-rail-green/15 text-rail-green border-rail-green/30',
  delayed: 'bg-rail-red/15 text-rail-red border-rail-red/30',

  // Train Categories
  superfast: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  express: 'bg-rail-orange/15 text-rail-orange border-rail-orange/30',
  passenger: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  freight: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  mail: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  other: 'bg-zinc-700/25 text-zinc-300 border-zinc-600/40',

  // Priorities & Generic States
  pending: 'bg-rail-amber/15 text-rail-amber border-rail-amber/30',
  approved: 'bg-rail-green/15 text-rail-green border-rail-green/30',
  rejected: 'bg-rail-red/15 text-rail-red border-rail-red/30',
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  completed: 'bg-zinc-700/25 text-zinc-300 border-zinc-600/40',
  high: 'bg-rail-red/15 text-rail-red border-rail-red/30',
  medium: 'bg-rail-amber/15 text-rail-amber border-rail-amber/30',
  low: 'bg-rail-blue/15 text-rail-blue border-rail-blue/30',
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const normalizedKey = (status || '').toLowerCase().replace('-', '_')
  const style =
    statusStyles[normalizedKey] ||
    statusStyles[(status || '').toLowerCase()] ||
    'bg-rail-surface text-rail-muted border-rail-border'
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'

  const label = (status || '').replace(/[-_]/g, ' ')

  return (
    <span className={`inline-flex items-center rounded-full border font-medium capitalize ${style} ${sizeClass}`}>
      {label}
    </span>
  )
}
