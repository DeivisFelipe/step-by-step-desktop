import { useState } from 'react'
import { TextPrompt, useIDEStore } from '../../store/useIDEStore'

const PromptForm = ({ prompt }: { prompt: TextPrompt }): React.JSX.Element => {
  const resolvePrompt = useIDEStore((s) => s.resolvePrompt)
  const [value, setValue] = useState(prompt.initialValue)

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    resolvePrompt(value.trim() ? value.trim() : null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-32"
      onMouseDown={() => resolvePrompt(null)}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[420px] rounded-md border border-ide-border bg-ide-panel p-4 shadow-2xl"
      >
        <label className="mb-2 block text-sm text-gray-300">{prompt.title}</label>
        <input
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          value={value}
          placeholder={prompt.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && resolvePrompt(null)}
          className="w-full rounded border border-ide-accent bg-ide-input px-2 py-1.5 text-sm text-white outline-none"
          spellCheck={false}
        />
        <div className="mt-4 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => resolvePrompt(null)}
            className="rounded px-3 py-1 text-gray-300 hover:bg-ide-hover"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded bg-ide-accent px-3 py-1 text-white hover:bg-sky-600"
          >
            OK
          </button>
        </div>
      </form>
    </div>
  )
}

/** Replacement for window.prompt, which Electron does not support. */
const PromptDialog = (): React.JSX.Element | null => {
  const prompt = useIDEStore((s) => s.prompt)
  if (!prompt) return null
  // Keyed by prompt so each request starts from its own initial value.
  return <PromptForm key={`${prompt.title}-${prompt.initialValue}`} prompt={prompt} />
}

export default PromptDialog
