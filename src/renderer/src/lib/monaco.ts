import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// Bundle Monaco and its workers locally instead of loading them from a CDN (blocked by the CSP).
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  }
}

loader.config({ monaco })

// Lesson projects are rarely full TS projects: don't flood the editor with
// "cannot find module" diagnostics while presenting.
const diagnostics = { noSemanticValidation: true, noSyntaxValidation: false }
monaco.typescript.typescriptDefaults.setDiagnosticsOptions(diagnostics)
monaco.typescript.javascriptDefaults.setDiagnosticsOptions(diagnostics)

/** Shared editor options; the larger font reads better on a projector. */
export const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 15,
  fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 10 },
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'on',
  mouseWheelZoom: true,
  tabSize: 2,
  renderWhitespace: 'selection',
  automaticLayout: true
}

/** Model URI used for a file on disk; shared by the editor and the execution engine. */
export function modelPathFor(filePath: string): string {
  return monaco.Uri.file(filePath).toString()
}

export { monaco }
