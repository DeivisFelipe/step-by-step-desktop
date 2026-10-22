import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { StageChallenge, StageSlide } from '../../shared/presentation'
import { renderMarkdown } from './markdown'
import { formatClock } from './format'
import './markdown.css'

export const Markdown = ({
  source,
  className
}: {
  source: string
  className?: string
}): React.JSX.Element => (
  <div
    className={`md ${className ?? ''}`}
    dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
  />
)

/**
 * Font size `max` shrunk until the element's content fits without being cut.
 * Returns the ref for the element (it must clip its overflow).
 */
function useFitFont(max: number, content: unknown): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = (): void => {
      let size = max
      el.style.fontSize = `${size}px`
      while (
        size > 10 &&
        (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
      ) {
        size = Math.floor(size * 0.92)
        el.style.fontSize = `${size}px`
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    // Images change the height when they load.
    el.querySelectorAll('img').forEach((img) => img.addEventListener('load', fit))
    return () => observer.disconnect()
  }, [max, content])
  return ref
}

/** A slide: Markdown, optionally next to an image. Long slides shrink to fit. */
export const SlideView = ({
  slide,
  fontSize = 28
}: {
  slide: StageSlide
  fontSize?: number
}): React.JSX.Element => {
  const ref = useFitFont(fontSize, slide)
  return (
    <div
      ref={ref}
      className="flex h-full w-full items-center justify-center gap-[4%] overflow-hidden p-[5%]"
      style={{ fontSize }}
    >
      {slide.markdown.trim() && (
        <Markdown source={slide.markdown} className={slide.image ? 'max-w-[50%]' : 'max-w-[90%]'} />
      )}
      {slide.image && (
        <img
          src={slide.image}
          alt=""
          className={`max-h-full rounded-lg object-contain ${slide.markdown.trim() ? 'max-w-[45%]' : 'max-w-full'}`}
        />
      )}
    </div>
  )
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/** A challenge with its countdown. `clockOffset` = server time - local time. */
export const ChallengeView = ({
  challenge,
  fontSize = 28,
  clockOffset = 0
}: {
  challenge: StageChallenge
  fontSize?: number
  clockOffset?: number
}): React.JSX.Element => {
  const fitRef = useFitFont(fontSize, challenge.markdown)
  const now = useNow(250) + clockOffset
  const remaining = challenge.endsAt - now
  const done = challenge.durationSec > 0 && remaining <= 0
  const progress =
    challenge.durationSec > 0 ? Math.max(0, remaining) / (challenge.durationSec * 1000) : 0

  return (
    <div
      ref={fitRef}
      className="flex h-full w-full flex-col items-center justify-center gap-[5%] overflow-hidden p-[5%] text-center"
      style={{ fontSize }}
    >
      <Markdown source={challenge.markdown} className="max-w-[90%]" />
      {challenge.durationSec > 0 && (
        <div className="flex w-[60%] flex-col items-center gap-3">
          <div
            className={`font-mono font-bold tabular-nums ${done ? 'animate-pulse text-red-400' : ''}`}
            style={{ fontSize: fontSize * 2.4 }}
          >
            {done ? 'Tempo!' : formatClock(remaining)}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
