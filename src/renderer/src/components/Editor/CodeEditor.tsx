import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { setCodeEditor } from '../../lib/registry'
import { EDITOR_OPTIONS, modelPathFor } from '../../lib/monaco'

const Message = ({ text }: { text: string }): React.JSX.Element => (
  <div className="flex h-full items-center justify-center text-sm text-ide-muted">{text}</div>
)

const CodeEditor = ({ path }: { path: string }): React.JSX.Element => {
  const file = useFileSystemStore((s) => s.files[path])
  const [missingPath, setMissingPath] = useState<string | null>(null)

  useEffect(() => {
    if (file) return
    useFileSystemStore
      .getState()
      .loadFile(path)
      .then((ok) => setMissingPath(ok ? null : path))
  }, [file, path])

  useEffect(() => () => setCodeEditor(null), [])

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
      onMount={(editor) => setCodeEditor(editor)}
      loading={<Message text="Carregando editor…" />}
      options={EDITOR_OPTIONS}
    />
  )
}

export default CodeEditor
