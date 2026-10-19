import { useEffect, useState } from 'react'
import {
  bundledLanguages,
  bundledThemes,
  createHighlighter,
  createJavaScriptRegexEngine,
  Highlighter
} from 'shiki'

let instance: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  instance ??= createHighlighter({
    themes: [],
    langs: [],
    engine: createJavaScriptRegexEngine()
  })
  return instance
}

export interface ReadyHighlighter {
  highlighter: Highlighter
  theme: string
  lang: string
  bg: string
  fg: string
}

/** Loads the theme and language on demand; falls back to plain text. */
export function useHighlighter(theme: string, language: string): ReadyHighlighter | null {
  const [ready, setReady] = useState<ReadyHighlighter | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const highlighter = await getHighlighter()
      const themeName = theme in bundledThemes ? theme : 'one-dark-pro'
      if (!highlighter.getLoadedThemes().includes(themeName)) {
        await highlighter.loadTheme(themeName as keyof typeof bundledThemes)
      }
      let lang = language in bundledLanguages ? language : 'text'
      if (lang !== 'text' && !highlighter.getLoadedLanguages().includes(lang)) {
        try {
          await highlighter.loadLanguage(lang as keyof typeof bundledLanguages)
        } catch {
          lang = 'text'
        }
      }
      const resolved = highlighter.getTheme(themeName)
      if (!cancelled) {
        setReady({ highlighter, theme: themeName, lang, bg: resolved.bg, fg: resolved.fg })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [theme, language])

  return ready
}
