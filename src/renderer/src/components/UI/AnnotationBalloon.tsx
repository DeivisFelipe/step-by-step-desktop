import { X, Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Toast, useIDEStore } from '../../store/useIDEStore'

const ICONS: Record<Toast['type'], React.JSX.Element> = {
  info: <Info size={18} className="text-sky-400" />,
  success: <CheckCircle2 size={18} className="text-green-400" />,
  warning: <AlertTriangle size={18} className="text-yellow-400" />,
  error: <AlertCircle size={18} className="text-red-400" />
}

/** Toast notifications in the bottom right corner. */
const Toasts = (): React.JSX.Element => {
  const toasts = useIDEStore((s) => s.toasts)
  const dismissToast = useIDEStore((s) => s.dismissToast)

  return (
    <div className="pointer-events-none fixed bottom-8 right-4 z-50 flex flex-col items-end gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="toast-in pointer-events-auto flex w-96 items-start gap-3 rounded border border-ide-border bg-ide-panel p-3 text-sm text-white shadow-xl"
        >
          <span className="mt-0.5 flex-none">{ICONS[toast.type]}</span>
          <div className="flex-1 break-words leading-relaxed">{toast.message}</div>
          <button
            onClick={() => dismissToast(toast.id)}
            className="flex-none text-gray-400 hover:text-white"
            title="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export default Toasts
