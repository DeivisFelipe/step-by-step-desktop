import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { useStageStore } from '../../store/useStageStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { setCodeEditor } from '../../lib/registry'
import { EDITOR_OPTIONS, modelPathFor, monaco } from '../../lib/monaco'

const Message = ({ text }: { text: string }): React.JSX.Element => (
  <div className="flex h-full items-center justify-center text-sm text-ide-muted">{text}</div>
)

type Editor = MonacoEditor.IStandaloneCodeEditor

/** Dims everything but the highlighted lines and shows the note below them. */
function useHighlight(editor: Editor | null, path: string, content: string | undefined): void {
  const highlight = useStageStore((s) => s.highlight)

  useEffect(() => {
    const model = editor?.getModel()
    if (!editor || !model || !highlight || highlight.path !== path) return
    if (model.uri.toString() !== modelPathFor(path)) return

    const last = model.getLineCount()
    const start = Math.min(highlight.startLine, last)
    const end = Math.min(highlight.endLine, last)
    const decorations: MonacoEditor.IModelDeltaDecoration[] = [
      {
        range: new monaco.Range(start, 1, end, model.getLineMaxColumn(end)),
        options: {
          isWholeLine: true,
          className: 'ssc-highlight-line',
          linesDecorationsClassName: 'ssc-highlight-gutter'
        }
      }
    ]
    if (start > 1) {
      decorations.push({
        range: new monaco.Range(1, 1, start - 1, model.getLineMaxColumn(start - 1)),
        options: { inlineClassName: 'ssc-dim' }
      })
    }
    if (end < last) {
      decorations.push({
        range: new monaco.Range(end + 1, 1, last, model.getLineMaxColumn(last)),
        options: { inlineClassName: 'ssc-dim' }
      })
    }
    const collection = editor.createDecorationsCollection(decorations)
    editor.revealLinesInCenter(start, end, monaco.editor.ScrollType.Smooth)

    let zoneId: string | null = null
    if (highlight.note) {
      const node = document.createElement('div')
      node.className = 'ssc-note-zone'
      const bubble = document.createElement('div')
      bubble.className = 'ssc-note'
      bubble.textContent = highlight.note
      node.appendChild(bubble)
      const lines = Math.max(
        Math.ceil(highlight.note.length / 90),
        highlight.note.split('\n').length
      )
      editor.changeViewZones((accessor) => {
        zoneId = accessor.addZone({
          afterLineNumber: end,
          heightInPx: 22 * lines + 26,
          domNode: node
        })
      })
    }

    return () => {
      collection.clear()
      if (zoneId) editor.changeViewZones((accessor) => accessor.removeZone(zoneId!))
    }
  }, [editor, highlight, path, content])
}

/** Briefly marks the lines changed by a step without typing animation. */
function useFlash(editor: Editor | null, path: string): void {
  const flash = useStageStore((s) => s.flash)

  useEffect(() => {
    const model = editor?.getModel()
    if (!editor || !model || !flash || flash.path !== path || flash.lines.length === 0) return
    const last = model.getLineCount()
    const lines = flash.lines.filter((l) => l <= last)
    if (lines.length === 0) return
    const collection = editor.createDecorationsCollection(
      lines.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: 'ssc-flash-line' }
      }))
    )
    editor.revealLinesInCenterIfOutsideViewport(lines[0], lines[lines.length - 1])
    const timer = setTimeout(() => collection.clear(), 1600)
    return () => {
      clearTimeout(timer)
      collection.clear()
    }
  }, [editor, flash, path])
}

const CodeEditor = ({ path }: { path: string }): React.JSX.Element => {
  const file = useFileSystemStore((s) => s.files[path])
  const projector = useSettingsStore((s) => s.settings.projector)
  const [missingPath, setMissingPath] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)

  useEffect(() => {
    if (file) return
    useFileSystemStore
      .getState()
      .loadFile(path)
      .then((ok) => setMissingPath(ok ? null : path))
  }, [file, path])

  useEffect(() => () => setCodeEditor(null), [])

  useHighlight(editor, path, file?.content)
  useFlash(editor, path)

  if (!file) {
    return (
      <Message text={missingPath === path ? 'Arquivo não encontrado no disco.' : 'Carregando…'} />
    )
  }

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      path={modelPathFor(path)}
      language={file.language}
      value={file.content}
      onChange={(value) => useFileSystemStore.getState().setContent(path, value ?? '')}
      onMount={(instance) => {
        setCodeEditor(instance)
        setEditor(instance)
      }}
      loading={<Message text="Carregando editor…" />}
      options={{ ...EDITOR_OPTIONS, fontSize: projector ? 22 : 15 }}
    />
  )
}

export default CodeEditor
