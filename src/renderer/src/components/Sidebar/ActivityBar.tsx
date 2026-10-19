import clsx from 'clsx'
import { Files, ListChecks, Presentation } from 'lucide-react'
import { useIDEStore } from '../../store/useIDEStore'

const ITEMS = [
  { id: 'EXPLORER', icon: Files, title: 'Explorador (Ctrl+B)' },
  { id: 'STEPS', icon: ListChecks, title: 'Passos da aula' },
  { id: 'PRESENT', icon: Presentation, title: 'Apresentação, OBS e exportação' }
] as const

const ActivityBar = (): React.JSX.Element => {
  const activeActivity = useIDEStore((s) => s.activeActivity)
  const sidebarVisible = useIDEStore((s) => s.sidebarVisible)
  const setActiveActivity = useIDEStore((s) => s.setActiveActivity)

  return (
    <div className="flex w-12 flex-none flex-col items-center bg-[#333333] py-1">
      {ITEMS.map((item) => {
        const active = sidebarVisible && activeActivity === item.id
        return (
          <button
            key={item.id}
            className={clsx(
              'relative flex h-12 w-12 items-center justify-center transition-colors',
              active ? 'text-white' : 'text-ide-muted hover:text-white'
            )}
            onClick={() => setActiveActivity(item.id)}
            title={item.title}
          >
            <item.icon size={24} strokeWidth={1.5} />
            {active && <div className="absolute bottom-0 left-0 top-0 w-0.5 bg-white" />}
          </button>
        )
      })}
    </div>
  )
}

export default ActivityBar
