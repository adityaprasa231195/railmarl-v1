import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  trend?: { value: string; positive: boolean }
}

export default function StatCard({ title, value, subtitle, icon: Icon, iconColor = 'text-rail-orange', trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-rail-border bg-rail-charcoal p-5 transition-colors hover:border-rail-muted/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-rail-muted uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-rail-muted">{subtitle}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-rail-green' : 'text-rail-red'}`}>
              {trend.value}
            </p>
          )}
        </div>
        <div className={`rounded-lg bg-rail-surface p-2.5 ${iconColor}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}
