import { useEffect, useState } from 'react'
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

/** A slide: Markdown, optionally next to an image. */
export const SlideView = ({
  slide,
  fontSize = 28
}: {
  slide: StageSlide
  fontSize?: number
}): React.JSX.Element => (
  <div
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
  const now = useNow(250) + clockOffset
  const remaining = challenge.endsAt - now
  const done = challenge.durationSec > 0 && remaining <= 0
  const progress =
    challenge.durationSec > 0 ? Math.max(0, remaining) / (challenge.durationSec * 1000) : 0

  return (
    <div
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
