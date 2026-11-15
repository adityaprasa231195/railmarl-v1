import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Layers,
  Train,
  Cpu,
  BarChart3,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

const navItems = [
  { to: '/overview', icon: LayoutDashboard, label: 'Overview' },
  { to: '/traffic', icon: Activity, label: 'Traffic' },
  { to: '/platforms', icon: Layers, label: 'Platforms' },
  { to: '/trains', icon: Train, label: 'Trains' },
  { to: '/allocation', icon: Cpu, label: 'Smart Allocation' },
  { to: '/insights', icon: BarChart3, label: 'ML Insights' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ open, onToggle }: SidebarProps) {
  return (
    <aside
      className={`${
        open ? 'w-60' : 'w-[72px]'
      } flex flex-col border-r border-rail-border bg-rail-charcoal transition-all duration-300 ease-in-out`}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-rail-border px-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rail-orange font-bold text-white text-sm">
            R
          </div>
          {open && (
            <div className="whitespace-nowrap">
              <h1 className="text-sm font-bold text-white tracking-wide">RAILMARL</h1>
              <p className="text-[10px] text-rail-muted">Platform Management</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="hidden lg:flex h-6 w-6 items-center justify-center rounded-md text-rail-muted hover:bg-rail-surface hover:text-white transition-colors"
        >
          {open ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-rail-orange/15 text-rail-orange'
                  : 'text-rail-muted hover:bg-rail-surface hover:text-white'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {open && <span className="whitespace-nowrap">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {open && (
        <div className="border-t border-rail-border p-4">
          <p className="text-[10px] text-rail-muted text-center">
            RAILMARL v1.0 — Stage 1
          </p>
        </div>
      )}
    </aside>
  )
}
