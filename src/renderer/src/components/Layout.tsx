import { useEffect } from 'react'
import ActivityBar from './Sidebar/ActivityBar'
import SidebarContainer from './Sidebar/SidebarContainer'
import MainEditor from './Editor/MainEditor'
import TerminalPanel from './Terminal/TerminalView'
import Toasts from './UI/AnnotationBalloon'
import PromptDialog from './UI/PromptDialog'
import Splitter from './UI/Splitter'
import StatusBar from './StatusBar'
import { reportError, useIDEStore } from '../store/useIDEStore'
import { useFileSystemStore } from '../store/useFileSystemStore'
import { usePlayerStore } from '../store/usePlayerStore'
import { chooseWorkspace, confirmUnsavedChanges } from '../lib/workspace'
import { flushLessonSave } from '../store/useLessonStore'
import { useStageStore } from '../store/useStageStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useAnnotatorStore } from '../store/useAnnotatorStore'
import Annotator from './UI/Annotator'
import PauseBar from './PauseBar'
import { runLabCommand, usePauseStore } from '../engine/ExecutionEngine'

function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const ide = useIDEStore.getState()
      const player = usePlayerStore.getState()
      const annotator = useAnnotatorStore.getState()
      const stage = useStageStore.getState()
      const clicker = useSettingsStore.getState().settings.keys.clicker
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const target = e.target as HTMLElement | null
      // Form fields keep PageUp/PageDown; the code editor (presenting) does not.
      const inForm =
        !!target?.matches?.('input, select, textarea') && !target.closest('.monaco-editor')
      const waiting = usePauseStore.getState().kind
      let handled = true

      // A menu waiting for a path: keys 1–9 pick it (not while typing in a field or the editor).
      if (
        waiting === 'choice' &&
        /^[1-9]$/.test(e.key) &&
        !ctrl &&
        !target?.matches?.('input, select, textarea') &&
        !target?.closest('.monaco-editor')
      ) {
        player.choose(Number(e.key) - 1)
      } else if (waiting === 'lab' && ctrl && e.key === 'Enter') runLabCommand()
      else if (e.key === 'F8' && !e.shiftKey) player.runNext()
      else if (e.key === 'F8' && e.shiftKey) player.undoLast()
      // Presentation clickers send PageDown / PageUp.
      else if (clicker && !inForm && e.key === 'PageDown' && !ctrl) player.runNext()
      else if (clicker && !inForm && e.key === 'PageUp' && !ctrl) player.undoLast()
      else if (e.key === 'F6') annotator.toggle('pen')
      else if (e.key === 'F7') annotator.toggle('spotlight')
      else if (e.key === 'Escape' && player.runningStepId) player.skip()
      else if (e.key === 'Escape' && annotator.mode !== 'off') annotator.close()
      else if (e.key === 'Escape' && stage.highlight) stage.setHighlight(null)
      else if (ctrl && key === 's') {
        const path = ide.activeFilePath()
        if (path) {
          useFileSystemStore
            .getState()
            .saveFile(path)
            .catch((err) => reportError(err, 'Não foi possível salvar'))
        }
      } else if (ctrl && key === 'o') chooseWorkspace()
      else if (ctrl && key === 'b') ide.toggleSidebar()
      else if (ctrl && (key === 'j' || e.key === '`' || e.code === 'Backquote'))
        ide.setTerminalVisible(!ide.terminalVisible)
      else if (ctrl && key === 'w' && ide.activeTabId) ide.closeTab(ide.activeTabId)
      else handled = false

      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Capture phase so Monaco and xterm don't swallow the shortcuts first.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      flushLessonSave()
      const { files } = useFileSystemStore.getState()
      if (Object.values(files).some((f) => f.content !== f.savedContent)) {
        e.preventDefault()
        // Ask asynchronously, then close for real.
        confirmUnsavedChanges().then((ok) => {
          if (ok) {
            for (const path of Object.keys(useFileSystemStore.getState().files)) {
              useFileSystemStore.getState().forgetFile(path)
            }
            window.close()
          }
        })
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])
}

const Layout = (): React.JSX.Element => {
  const sidebarVisible = useIDEStore((s) => s.sidebarVisible)
  const sidebarWidth = useIDEStore((s) => s.sidebarWidth)
  const setSidebarWidth = useIDEStore((s) => s.setSidebarWidth)
  const terminalVisible = useIDEStore((s) => s.terminalVisible)
  const terminalHeight = useIDEStore((s) => s.terminalHeight)
  const setTerminalHeight = useIDEStore((s) => s.setTerminalHeight)

  useGlobalShortcuts()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ide-bg text-ide-text">
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        {sidebarVisible && (
          <>
            <div className="flex-none overflow-hidden" style={{ width: sidebarWidth }}>
              <SidebarContainer />
            </div>
            <Splitter axis="x" size={sidebarWidth} onResize={setSidebarWidth} />
          </>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <MainEditor />
            <PauseBar />
          </div>
          {terminalVisible && (
            <Splitter axis="y" size={terminalHeight} onResize={setTerminalHeight} invert />
          )}
          {/* Kept mounted while hidden so the shell session survives. */}
          <div
            className={terminalVisible ? 'flex-none' : 'hidden'}
            style={{ height: terminalHeight }}
          >
            <TerminalPanel />
          </div>
        </div>
      </div>
      <StatusBar />
      <Toasts />
      <PromptDialog />
      <Annotator />
    </div>
  )
}

export default Layout
