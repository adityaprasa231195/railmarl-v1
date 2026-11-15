import { Menu, Bell, MapPin } from 'lucide-react'

interface TopNavProps {
  onMenuToggle: () => void
}

export default function TopNav({ onMenuToggle }: TopNavProps) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  return (
    <header className="flex h-16 items-center justify-between border-b border-rail-border bg-rail-charcoal px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-rail-muted hover:bg-rail-surface hover:text-white transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 text-sm text-rail-muted">
          <MapPin size={14} className="text-rail-orange" />
          <span>Itarsi Junction, Madhya Pradesh</span>
          <span className="mx-2 text-rail-border">|</span>
          <span>{dateStr}</span>
          <span className="mx-2 text-rail-border">|</span>
          <span className="text-white font-medium">{timeStr}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative rounded-lg p-2 text-rail-muted hover:bg-rail-surface hover:text-white transition-colors">
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rail-orange" />
        </button>
        <div className="flex items-center gap-2 rounded-lg bg-rail-surface px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rail-orange text-xs font-bold text-white">
            SM
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-white">Station Master</p>
            <p className="text-[10px] text-rail-muted">Itarsi Jn.</p>
          </div>
        </div>
      </div>
    </header>
  )
}
