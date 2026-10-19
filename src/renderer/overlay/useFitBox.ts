import { createContext, useEffect, useRef, useState } from 'react'

/** Design resolution of each aspect; the stage is drawn at this size and scaled to fit. */
const DESIGN: Record<string, [number, number]> = {
  '16:9': [1920, 1080],
  '4:3': [1440, 1080],
  '1:1': [1080, 1080],
  '9:16': [1080, 1920]
}

export interface DesignScale {
  width: number
  height: number
  scale: number
}

/**
 * Fits the design resolution of `aspect` inside the element, so the stage looks
 * the same at any OBS source size. "livre" uses the element size as is.
 */
export function useDesignScale(aspect: string): {
  ref: React.RefObject<HTMLDivElement | null>
  fit: DesignScale | null
} {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<DesignScale | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (): void => {
      const { width, height } = el.getBoundingClientRect()
      const design = DESIGN[aspect]
      if (!design) {
        setFit({ width, height, scale: 1 })
        return
      }
      setFit({
        width: design[0],
        height: design[1],
        scale: Math.min(width / design[0], height / design[1])
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [aspect])

  return { ref, fit }
}

/** CSS scale applied to the stage (Magic Move needs it to place tokens). */
export const ScaleContext = createContext(1)
