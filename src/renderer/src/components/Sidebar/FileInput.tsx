import { useState } from 'react'
import { FileIcon } from '../UI/FileIcon'

interface FileInputProps {
  initialValue?: string
  type: 'file' | 'folder'
  depth: number
  onSubmit: (value: string) => void
  onCancel: () => void
}

const INVALID_NAME = /[<>:"|?*]/

/** Inline name input used to create and rename files in the explorer. */
export const FileInput = ({
  initialValue = '',
  type,
  depth,
  onSubmit,
  onCancel
}: FileInputProps): React.JSX.Element => {
  const [value, setValue] = useState(initialValue)
  const [done, setDone] = useState(false)
  const error = INVALID_NAME.test(value) ? 'O nome contém caracteres inválidos.' : null

  const finish = (): void => {
    if (done) return
    setDone(true)
    const name = value.trim()
    if (name && !error && name !== initialValue) onSubmit(name)
    else onCancel()
  }

  return (
    <div className="relative" style={{ paddingLeft: `${depth * 12 + 22}px` }}>
      <div className="flex items-center py-[3px] pr-2">
        <span className="mr-1.5 flex-none">
          <FileIcon name={value || 'file'} isDirectory={type === 'folder'} />
        </span>
        <input
          autoFocus
          onFocus={(e) => {
            // Select the name without the extension, like VS Code.
            const dot = type === 'file' ? e.currentTarget.value.lastIndexOf('.') : -1
            e.currentTarget.setSelectionRange(0, dot > 0 ? dot : e.currentTarget.value.length)
          }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') finish()
            else if (e.key === 'Escape') {
              setDone(true)
              onCancel()
            }
          }}
          onBlur={finish}
          onClick={(e) => e.stopPropagation()}
          className="w-full min-w-0 border border-ide-accent bg-ide-input px-1 text-[13px] text-white outline-none"
          spellCheck={false}
        />
      </div>
      {error && (
        <div className="absolute left-6 right-2 z-10 border border-red-700 bg-red-950 px-2 py-1 text-xs text-red-200">
          {error}
        </div>
      )}
    </div>
  )
}
