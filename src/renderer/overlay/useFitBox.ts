import { useEffect, useRef, useState } from 'react'

const RATIOS: Record<string, number> = { '16:9': 16 / 9, '4:3': 4 / 3, '9:16': 9 / 16, '1:1': 1 }

/** Largest box with the style's aspect ratio that fits the available area. */
export function useFitBox(aspect: string): {
  ref: React.RefObject<HTMLDivElement | null>
  size: { width: number; height: number } | null
} {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (): void => {
      const { width, height } = el.getBoundingClientRect()
      const ratio = RATIOS[aspect]
      if (!ratio) {
        setSize({ width, height })
        return
      }
      const fitWidth = Math.min(width, height * ratio)
      setSize({ width: fitWidth, height: fitWidth / ratio })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [aspect])

  return { ref, size }
}
