import { useEffect } from 'react'
import clsx from 'clsx'
import {
  FlaskConical,
  GitBranch,
  Globe,
  LucideIcon,
  Presentation,
  Settings,
  Trophy,
  Workflow,
  X
} from 'lucide-react'
import { SpecialTabType, Tab, useIDEStore } from '../../store/useIDEStore'
import { useStageStore } from '../../store/useStageStore'
import { StageView } from '../../../../shared/presentation'
import { ChallengeTab, PreviewTab, SlideTab } from '../Stage/StageTabs'
import SettingsView from '../Settings/SettingsView'
import RehearsalView from '../Rehearsal/RehearsalView'
import GitImportView from '../Import/GitImportView'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { useLessonStore } from '../../store/useLessonStore'
import { findNode, primaryKind } from '../../lib/tree'
import { ActionIcon } from '../UI/ActionIcon'
import { basename, relativeTo } from '../../lib/paths'
import { FileIcon } from '../UI/FileIcon'
import CodeEditor from './CodeEditor'
import StepConfigEditor from './StepConfigEditor'
import FlowEditor from '../Flow/FlowEditor'
import Welcome from './Welcome'

const SPECIAL: Record<SpecialTabType, { title: string; icon: LucideIcon; color: string }> = {
  SLIDE: { title: 'Slide', icon: Presentation, color: 'text-emerald-400' },
  CHALLENGE: { title: 'Desafio', icon: Trophy, color: 'text-orange-400' },
  PREVIEW: { title: 'Preview', icon: Globe, color: 'text-cyan-300' },
  SETTINGS: { title: 'Configurações', icon: Settings, color: 'text-gray-300' },
  REHEARSAL: { title: 'Ensaio da aula', icon: FlaskConical, color: 'text-lime-300' },
  GIT_IMPORT: { title: 'Importar do git', icon: GitBranch, color: 'text-orange-300' }
}

/** What the presentation shows when a tab is selected by hand. */
const VIEW_OF_TAB: Partial<Record<Tab['type'], StageView>> = {
  FILE: 'code',
  SLIDE: 'slide',
  CHALLENGE: 'challenge',
  PREVIEW: 'preview'
}

const TabButton = ({ tab, active }: { tab: Tab; active: boolean }): React.JSX.Element => {
  const node = useLessonStore((s) =>
    tab.type === 'STEP' || tab.type === 'FLOW' ? findNode(s.tree, tab.id) : null
  )
  const special = tab.type in SPECIAL ? SPECIAL[tab.type as SpecialTabType] : null
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const isDirty = useFileSystemStore((s) => {
    const f = tab.type === 'FILE' ? s.files[tab.id] : undefined
    return !!f && f.content !== f.savedContent
  })

  const title =
    tab.type === 'FILE' ? basename(tab.id) : special ? special.title : (node?.title ?? 'Removido')
  const tooltip = tab.type === 'FILE' ? relativeTo(rootPath, tab.id) : title
  const icon =
    tab.type === 'FILE' ? (
      <FileIcon name={title} />
    ) : special ? (
      <special.icon size={16} className={special.color} />
    ) : tab.type === 'FLOW' ? (
      <Workflow size={16} className="text-[#dcb67a]" />
    ) : node ? (
      <ActionIcon kind={primaryKind(node)} />
    ) : (
      <FileIcon name="" />
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
      <span
        className={clsx(
          'flex-1 truncate',
          (tab.type === 'STEP' || tab.type === 'FLOW') && 'italic'
        )}
      >
        {title}
      </span>
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
  const activeType = activeTab?.type

  useEffect(() => {
    const view = activeType ? VIEW_OF_TAB[activeType] : undefined
    if (view) useStageStore.getState().setView(view)
  }, [activeTabId, activeType])

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
        ) : activeTab.type === 'STEP' ? (
          <StepConfigEditor key={activeTab.id} stepId={activeTab.id} />
        ) : activeTab.type === 'SLIDE' ? (
          <SlideTab />
        ) : activeTab.type === 'CHALLENGE' ? (
          <ChallengeTab />
        ) : activeTab.type === 'PREVIEW' ? (
          <PreviewTab />
        ) : activeTab.type === 'SETTINGS' ? (
          <SettingsView />
        ) : activeTab.type === 'REHEARSAL' ? (
          <RehearsalView />
        ) : (
          <GitImportView />
        )}
      </div>
    </div>
  )
}

export default MainEditor
