import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  HTML_SLIDE_SIZE,
  SlideTransition,
  StageChallenge,
  StageSlide
} from '../../shared/presentation'
import { renderMarkdown } from './markdown'
import { formatClock } from './format'
import './markdown.css'
import './transitions.css'

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

/**
 * An HTML slide: a page of the presentation server drawn at 1920×1080 and scaled to fit,
 * so it looks the same in the app, on stage and on the students' page.
 */
export const HtmlSlide = ({
  src,
  fill = false
}: {
  src: string
  /** Fill the whole area: 1920 wide, as tall as the area's shape needs (no bars). */
  fill?: boolean
}): React.JSX.Element => {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [height, setHeight] = useState<number>(HTML_SLIDE_SIZE.height)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (): void => {
      if (fill && el.clientWidth > 0) {
        const s = el.clientWidth / HTML_SLIDE_SIZE.width
        setScale(s)
        setHeight(el.clientHeight / s)
        return
      }
      setHeight(HTML_SLIDE_SIZE.height)
      setScale(
        Math.min(el.clientWidth / HTML_SLIDE_SIZE.width, el.clientHeight / HTML_SLIDE_SIZE.height)
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [fill])
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      {scale > 0 && (
        <iframe
          src={src}
          title="Slide"
          // Scripts run, but the slide cannot reach the app or the server's other pages.
          sandbox="allow-scripts"
          className="absolute left-1/2 top-1/2 border-0 bg-transparent"
          style={{
            width: HTML_SLIDE_SIZE.width,
            height,
            transform: `translate(-50%, -50%) scale(${scale})`
          }}
        />
      )}
    </div>
  )
}

/**
 * A slide: Markdown (optionally next to an image, shrinking to fit) or HTML.
 * `server` is the presentation server's origin, used for HTML slides.
 */
export const SlideView = ({
  slide,
  fontSize = 28,
  server = '',
  fill = false
}: {
  slide: Omit<StageSlide, 'key'>
  fontSize?: number
  server?: string
  fill?: boolean
}): React.JSX.Element => {
  if (slide.htmlPath) return <HtmlSlide src={server + slide.htmlPath} fill={fill} />
  return <MarkdownSlide slide={slide} fontSize={fontSize} />
}

const MarkdownSlide = ({
  slide,
  fontSize
}: {
  slide: Omit<StageSlide, 'key'>
  fontSize: number
}): React.JSX.Element => {
  const ref = useFitFont(fontSize, slide.markdown + (slide.image ?? ''))
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

interface Layer<T> {
  key: number | string
  data: T
}

/**
 * Shows `data` and animates the change when `itemKey` changes: the previous content
 * leaves while the new one enters, with the given transition.
 */
export function TransitionStack<T>({
  itemKey,
  data,
  transition,
  duration,
  render
}: {
  itemKey: number | string
  data: T
  transition: SlideTransition
  duration: number
  render: (data: T) => React.ReactNode
}): React.JSX.Element {
  const [current, setCurrent] = useState<Layer<T>>({ key: itemKey, data })
  const [leaving, setLeaving] = useState<Layer<T>[]>([])
  const [kind, setKind] = useState<SlideTransition>(transition)

  // Derived state: a new key starts a transition (React's "adjust state on prop change").
  if (current.key !== itemKey) {
    setLeaving(transition === 'none' ? [] : [...leaving, current])
    setKind(transition)
    setCurrent({ key: itemKey, data })
  } else if (current.data !== data) {
    setCurrent({ key: itemKey, data })
  }

  useEffect(() => {
    if (leaving.length === 0) return
    const timer = setTimeout(() => setLeaving([]), duration + 50)
    return () => clearTimeout(timer)
  }, [leaving, duration])

  const animated = kind !== 'none'
  return (
    <div className="sst-stage" style={{ '--sst-ms': `${duration}ms` } as React.CSSProperties}>
      {leaving.map((layer) => (
        <div key={layer.key} className={`sst-layer sst-out sst-${kind}`}>
          {render(layer.data)}
        </div>
      ))}
      <div key={current.key} className={animated ? `sst-layer sst-in sst-${kind}` : 'sst-layer'}>
        {render(current.data)}
      </div>
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
