import { useContext, useEffect, useMemo, useRef } from 'react'
import { ShikiMagicMove } from '@shikijs/magic-move/react'
import '@shikijs/magic-move/style.css'
import type { Element, ElementContent } from 'hast'
import { PresentationStyle, StageCode } from '../../shared/presentation'
import { ReadyHighlighter } from './highlighter'
import { ScaleContext } from './useFitBox'

const LINE_HEIGHT = 1.6

/** Static highlight with dimmed lines, focus range and the note bubble. */
function StaticCode({
  code,
  style,
  ready,
  wrap
}: {
  code: StageCode
  style: PresentationStyle
  ready: ReadyHighlighter
  wrap?: boolean
}): React.JSX.Element {
  const html = useMemo(() => {
    const highlight = code.highlight
    return ready.highlighter.codeToHtml(code.content.replace(/\n$/, ''), {
      lang: ready.lang,
      theme: ready.theme,
      transformers: [
        {
          line(node: Element, line: number) {
            const classes = ['line']
            if (highlight) {
              classes.push(
                line >= highlight.startLine && line <= highlight.endLine ? 'focus' : 'dim'
              )
            }
            node.properties.class = classes.join(' ')
            if (style.lineNumbers) {
              node.children.unshift({
                type: 'element',
                tagName: 'span',
                properties: { class: 'line-number' },
                children: [{ type: 'text', value: String(line) }]
              } as ElementContent)
            }
          },
          // The note goes in its own block right below the last highlighted line,
          // like the balloon in the IDE editor.
          code(node: Element) {
            if (!highlight?.note) return
            let seen = 0
            const index = node.children.findIndex(
              (child) =>
                child.type === 'element' &&
                String(child.properties?.class ?? '').includes('line') &&
                ++seen === highlight.endLine
            )
            if (index === -1) return
            const after = node.children[index + 1]?.type === 'text' ? index + 2 : index + 1
            node.children.splice(after, 0, {
              type: 'element',
              tagName: 'span',
              properties: {
                class: 'ssc-note-row',
                style: style.lineNumbers ? 'padding-left:3.7em' : ''
              },
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: { class: 'ssc-note' },
                  children: [{ type: 'text', value: highlight.note }]
                }
              ]
            } as ElementContent)
          }
        }
      ]
    })
  }, [code.content, code.highlight, ready, style.lineNumbers])

  return (
    <div
      className="ssc-code"
      style={{ whiteSpace: wrap ? 'pre-wrap' : undefined }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * Code on stage. Typing updates re-render instantly; "morph" changes animate
 * with Shiki Magic Move; highlights dim everything but the focused lines.
 */
export const CodeContent = ({
  code,
  style,
  ready,
  fontSize,
  scroll = true
}: {
  code: StageCode
  style: PresentationStyle
  ready: ReadyHighlighter | null
  fontSize?: number
  scroll?: boolean
}): React.JSX.Element => {
  const scroller = useRef<HTMLDivElement>(null)
  const globalScale = useContext(ScaleContext)
  const size = fontSize ?? style.fontSize
  const target = code.highlight
    ? (code.highlight.startLine + code.highlight.endLine) / 2
    : code.cursorLine

  // Keep the cursor (or the highlighted lines) in view.
  useEffect(() => {
    const el = scroller.current
    if (!el || !scroll) return
    const line = size * LINE_HEIGHT
    const top = (target - 1) * line - el.clientHeight / 2 + line
    el.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [target, code.version, size, scroll])

  const content = !ready ? (
    <pre>{code.content}</pre>
  ) : code.highlight ? (
    <StaticCode code={code} style={style} ready={ready} />
  ) : (
    <ShikiMagicMove
      highlighter={ready.highlighter}
      lang={ready.lang}
      theme={ready.theme}
      code={code.content.replace(/\n$/, '')}
      options={{
        duration: code.transition === 'morph' ? style.morphDuration : 1,
        lineNumbers: style.lineNumbers,
        stagger: 0,
        containerStyle: false,
        globalScale
      }}
    />
  )

  return (
    <div
      ref={scroller}
      className="ssc-code h-full w-full overflow-hidden"
      style={{
        fontFamily: style.fontFamily,
        fontSize: size,
        lineHeight: LINE_HEIGHT,
        padding: `${size * 0.6}px ${size}px`
      }}
    >
      {content}
      <div style={{ height: '40%' }} />
    </div>
  )
}

export { StaticCode }
