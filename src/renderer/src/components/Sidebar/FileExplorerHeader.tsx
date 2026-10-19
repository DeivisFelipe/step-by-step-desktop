import { LucideIcon } from 'lucide-react'

export interface HeaderAction {
  icon: LucideIcon
  title: string
  onClick: () => void
  disabled?: boolean
}

interface SidebarHeaderProps {
  title: string
  actions?: HeaderAction[]
}

/** Section title with icon buttons, shared by the explorer and the steps panel. */
export const SidebarHeader = ({ title, actions = [] }: SidebarHeaderProps): React.JSX.Element => {
  return (
    <div className="flex h-9 flex-none items-center justify-between pl-5 pr-2 text-[11px] font-bold uppercase tracking-wider text-ide-text">
      <span className="truncate" title={title}>
        {title}
      </span>
      <div className="flex items-center gap-0.5">
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={(e) => {
              e.stopPropagation()
              action.onClick()
            }}
            disabled={action.disabled}
            className="rounded p-1 hover:bg-ide-border disabled:opacity-30 disabled:hover:bg-transparent"
            title={action.title}
          >
            <action.icon size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}
