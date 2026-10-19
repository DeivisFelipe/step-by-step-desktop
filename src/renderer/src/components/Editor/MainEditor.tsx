import clsx from 'clsx'
import { FileCode, Terminal, Workflow, X } from 'lucide-react'
import { Tab, useIDEStore } from '../../store/useIDEStore'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { useLessonStore } from '../../store/useLessonStore'
import { findNode } from '../../lib/tree'
import { basename, relativeTo } from '../../lib/paths'
import { FileIcon } from '../UI/FileIcon'
import CodeEditor from './CodeEditor'
import StepConfigEditor from './StepConfigEditor'
import FlowEditor from '../Flow/FlowEditor'
import Welcome from './Welcome'

const TabButton = ({ tab, active }: { tab: Tab; active: boolean }): React.JSX.Element => {
  const node = useLessonStore((s) => (tab.type === 'FILE' ? null : findNode(s.tree, tab.id)))
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const isDirty = useFileSystemStore((s) => {
    const f = tab.type === 'FILE' ? s.files[tab.id] : undefined
    return !!f && f.content !== f.savedContent
  })

  const title = tab.type === 'FILE' ? basename(tab.id) : (node?.title ?? 'Removido')
  const tooltip = tab.type === 'FILE' ? relativeTo(rootPath, tab.id) : title
  const icon =
    tab.type === 'FILE' ? (
      <FileIcon name={title} />
    ) : tab.type === 'FLOW' ? (
      <Workflow size={16} className="text-[#dcb67a]" />
    ) : node?.data?.action.kind === 'TERMINAL' ? (
      <Terminal size={16} className="text-purple-400" />
    ) : (
      <FileCode size={16} className="text-sky-400" />
    )

  const close = (e: React.MouseEvent): void => {
    e.stopPropagation()
    useIDEStore.getState().closeTab(tab.id)
  }

  return (
    <div
      className={clsx(
        'group flex h-full min-w-[110px] max-w-[220px] flex-shrink-0 cursor-pointer items-center gap-2 border-r border-ide-bg pl-3 pr-1.5 text-[13px]',
        active
          ? 'border-t border-t-ide-accent bg-ide-bg text-white'
          : 'bg-ide-tab text-[#969696] hover:text-gray-200'
      )}
      title={tooltip}
      onClick={() => useIDEStore.getState().setActiveTab(tab.id)}
      onMouseDown={(e) => e.button === 1 && close(e)}
    >
      <span className="flex-none">{icon}</span>
      <span className={clsx('flex-1 truncate', tab.type !== 'FILE' && 'italic')}>{title}</span>
      <button
        onClick={close}
        className="relative flex h-5 w-5 flex-none items-center justify-center rounded hover:bg-ide-border"
        title="Fechar (Ctrl+W)"
      >
        {isDirty && (
          <span className="absolute h-2 w-2 rounded-full bg-gray-300 group-hover:hidden" />
        )}
        <X
          size={14}
          className={clsx(
            isDirty && 'invisible group-hover:visible',
            !active && !isDirty && 'invisible group-hover:visible'
          )}
        />
      </button>
    </div>
  )
}

const MainEditor = (): React.JSX.Element => {
  const tabs = useIDEStore((s) => s.tabs)
  const activeTabId = useIDEStore((s) => s.activeTabId)
  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex h-full flex-col">
      {tabs.length > 0 && (
        <div className="tab-strip flex h-9 flex-none overflow-x-auto overflow-y-hidden bg-ide-panel">
          {tabs.map((tab) => (
            <TabButton key={tab.id} tab={tab} active={tab.id === activeTabId} />
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 bg-ide-bg">
        {!activeTab ? (
          <Welcome />
        ) : activeTab.type === 'FILE' ? (
          <CodeEditor path={activeTab.id} />
        ) : activeTab.type === 'FLOW' ? (
          <FlowEditor flowId={activeTab.id} />
        ) : (
          <StepConfigEditor key={activeTab.id} stepId={activeTab.id} />
        )}
      </div>
    </div>
  )
}

export default MainEditor
