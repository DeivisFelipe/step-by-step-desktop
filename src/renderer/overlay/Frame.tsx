import { PresentationStyle } from '../../shared/presentation'
import { ScaleContext, useDesignScale } from './useFitBox'

/**
 * Page background, with the stage drawn at its design resolution and scaled
 * to fit (letterboxed by the background).
 */
export const Page = ({
  style,
  children
}: {
  style: PresentationStyle
  children: React.ReactNode
}): React.JSX.Element => {
  const { ref, fit } = useDesignScale(style.aspect)
  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden"
      style={{ background: style.transparent ? 'transparent' : style.background }}
    >
      {fit && (
        <div
          className="absolute left-1/2 top-1/2 flex flex-col"
          style={{
            width: fit.width,
            height: fit.height,
            padding: style.padding,
            transform: `translate(-50%, -50%) scale(${fit.scale})`
          }}
        >
          <ScaleContext.Provider value={fit.scale}>{children}</ScaleContext.Provider>
        </div>
      )}
    </div>
  )
}

/** A window (macOS / Windows / bare) with the code, terminal or preview inside. */
export const AppWindow = ({
  style,
  title,
  bg,
  fg,
  children
}: {
  style: PresentationStyle
  title: string
  bg: string
  fg: string
  children: React.ReactNode
}): React.JSX.Element => {
  const bar = Math.max(28, style.fontSize * 1.3)
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        background: bg,
        color: fg,
        borderRadius: style.radius,
        boxShadow: style.shadow
          ? '0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)'
          : 'none'
      }}
    >
      {style.chrome !== 'none' && (
        <div
          className="relative flex flex-none items-center px-4"
          style={{ height: bar, fontSize: Math.max(12, style.fontSize * 0.55) }}
        >
          {style.chrome === 'mac' && (
            <div className="flex gap-2">
              {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                <span
                  key={c}
                  className="rounded-full"
                  style={{ background: c, width: bar * 0.42, height: bar * 0.42 }}
                />
              ))}
            </div>
          )}
          {style.showTitle && (
            <span
              className={
                style.chrome === 'mac'
                  ? 'absolute inset-x-0 text-center opacity-60'
                  : 'flex-1 opacity-70'
              }
            >
              {title}
            </span>
          )}
          {style.chrome === 'windows' && (
            <span className="ml-auto flex gap-5 opacity-60">
              <span>—</span>
              <span>▢</span>
              <span>✕</span>
            </span>
          )}
        </div>
      )}
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  )
}
