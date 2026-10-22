import { useEffect } from 'react'
import { PresentationStyle, StagePayload } from '../../shared/presentation'
import { ChallengeView, Markdown, SlideView, TransitionStack } from '../common/StageViews'
import { PARAMS, SERVER, sendCommand, useConnection } from './connection'
import { usePresentationStyle, useStage } from './style'
import { AppWindow, Page } from './Frame'
import { CodeContent } from './CodeContent'
import { TerminalContent } from './TerminalContent'
import { ReadyHighlighter, useHighlighter } from './highlighter'
import StudentPage from './StudentPage'
import PresenterPage from './PresenterPage'

function pageName(): string {
  return (PARAMS.get('view') ?? location.pathname.replace(/^\/+|\/+$/g, '')) || 'palco'
}

const Caption = ({ text, size }: { text: string; size: number }): React.JSX.Element | null => {
  if (!text.trim()) return null
  return (
    <div
      key={text}
      className="caption-in mx-auto w-fit max-w-[90%] rounded-2xl bg-black/65 px-[1.1em] py-[0.6em] text-center text-white shadow-2xl backdrop-blur"
      style={{ fontSize: size }}
    >
      <Markdown source={text} />
    </div>
  )
}

/** The area left for the window after the captions. */
const FitArea = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <div className="min-h-0 w-full flex-1">{children}</div>
)

/**
 * Translucent card for slides and challenges, readable over any background.
 * `plain` (HTML slides) leaves the background to the slide's own design.
 */
const Card = ({
  style,
  plain = false,
  children
}: {
  style: PresentationStyle
  plain?: boolean
  children: React.ReactNode
}): React.JSX.Element => (
  <div
    className={`h-full w-full overflow-hidden text-white ${plain ? '' : 'backdrop-blur-md'}`}
    style={{
      background: plain ? 'transparent' : 'rgba(10, 12, 20, 0.55)',
      borderRadius: style.radius,
      boxShadow: style.shadow ? '0 30px 80px rgba(0,0,0,0.45)' : 'none'
    }}
  >
    {children}
  </div>
)

type Part = 'code' | 'terminal' | 'slide' | 'auto'

/** What the page shows: the stage view for "auto", otherwise the page's own part. */
function viewFor(stage: StagePayload | null, part: Part): string {
  if (part === 'auto') return stage?.view ?? 'code'
  if (part === 'slide') {
    return stage?.view === 'challenge' || (!stage?.slide && stage?.challenge)
      ? 'challenge'
      : 'slide'
  }
  return part
}

/** The slide takes the whole page (option of the slide or of the style). */
function isFullscreenSlide(
  stage: StagePayload | null,
  part: Part,
  style: PresentationStyle
): boolean {
  if (viewFor(stage, part) !== 'slide' || !stage?.slide) return false
  return stage.slide.fullscreen ?? style.slideFullscreen
}

/** The window with whatever `part` shows (or the current stage view for "auto"). */
const StageContent = ({
  stage,
  style,
  part,
  ready,
  fill = false
}: {
  stage: StagePayload | null
  style: PresentationStyle
  part: Part
  ready: ReadyHighlighter | null
  /** Full screen slide: fills the page instead of keeping 16:9. */
  fill?: boolean
}): React.JSX.Element | null => {
  const bg = ready?.bg ?? '#1e1e1e'
  const fg = ready?.fg ?? '#d4d4d4'
  const clockOffset = useConnection((s) => s.clockOffset)
  const view = viewFor(stage, part)

  if (view === 'slide' && stage?.slide) {
    const slide = stage.slide
    return (
      <Card style={style} plain={!!slide.htmlPath}>
        <TransitionStack
          itemKey={slide.key}
          data={slide}
          transition={slide.transition ?? style.slideTransition}
          duration={style.slideTransitionMs}
          render={(s) => (
            <SlideView slide={s} fontSize={style.slideFontSize} server={SERVER} fill={fill} />
          )}
        />
      </Card>
    )
  }

  if (view === 'slide' || view === 'challenge') {
    const content =
      view === 'challenge' && stage?.challenge ? (
        <ChallengeView
          challenge={stage.challenge}
          fontSize={style.slideFontSize}
          clockOffset={clockOffset}
        />
      ) : null
    if (!content) return null
    return (
      <Card style={style}>
        <div key={view} className="fade-in h-full w-full">
          {content}
        </div>
      </Card>
    )
  }

  if (view === 'lab' && stage?.lab) {
    const codeWindow = (
      <AppWindow style={style} title={stage.code?.path ?? ''} bg={bg} fg={fg}>
        {stage.code ? <CodeContent code={stage.code} style={style} ready={ready} /> : null}
      </AppWindow>
    )
    const terminalWindow = (
      <AppWindow style={style} title={stage.terminalName || 'Terminal'} bg={bg} fg={fg}>
        <TerminalContent
          terminalId={stage.terminalId}
          fontSize={style.terminalFontSize}
          fontFamily={style.fontFamily}
          background={bg}
          foreground={fg}
        />
      </AppWindow>
    )
    if (stage.lab.layout === 'tabs') {
      // One window at a time: the code while it is edited, the terminal when it runs.
      return (
        <div key={stage.lab.tab} className="fade-in h-full w-full">
          {stage.lab.tab === 'terminal' ? terminalWindow : codeWindow}
        </div>
      )
    }
    return (
      <div
        className={`flex h-full w-full gap-[2%] ${stage.lab.layout === 'vertical' ? 'flex-col' : ''}`}
      >
        <div className="min-h-0 min-w-0 flex-1">{codeWindow}</div>
        <div className="min-h-0 min-w-0 flex-1">{terminalWindow}</div>
      </div>
    )
  }

  if (view === 'terminal') {
    return (
      <AppWindow style={style} title={stage?.terminalName || 'Terminal'} bg={bg} fg={fg}>
        <TerminalContent
          terminalId={stage?.terminalId ?? null}
          fontSize={style.terminalFontSize}
          fontFamily={style.fontFamily}
          background={bg}
          foreground={fg}
        />
      </AppWindow>
    )
  }

  if (view === 'preview' && stage?.preview) {
    return (
      <AppWindow style={style} title={stage.preview} bg="#ffffff" fg="#111827">
        <iframe src={stage.preview} className="h-full w-full border-0 bg-white" title="Preview" />
      </AppWindow>
    )
  }

  const code = stage?.code
  return (
    <AppWindow style={style} title={code?.path ?? ''} bg={bg} fg={fg}>
      {code ? <CodeContent code={code} style={style} ready={ready} /> : null}
    </AppWindow>
  )
}

const StagePage = ({ part }: { part: Part }): React.JSX.Element => {
  const baseStyle = usePresentationStyle()
  const stage = useStage()
  const fullscreen = isFullscreenSlide(stage, part, baseStyle)
  // Full screen: 100% of the page in both directions, without the page background.
  const style: PresentationStyle = fullscreen
    ? {
        ...baseStyle,
        padding: 0,
        radius: 0,
        shadow: false,
        aspect: 'livre',
        transparent: true
      }
    : baseStyle
  const ready = useHighlighter(style.theme, stage?.code?.language ?? 'text')
  const showCaption = part === 'auto' && style.captionPosition !== 'none'
  const caption = showCaption ? (
    <Caption text={stage?.caption ?? ''} size={style.captionSize} />
  ) : null

  if (fullscreen) {
    // The caption floats over a full screen slide instead of taking space from it.
    return (
      <Page style={style}>
        <FitArea>
          <StageContent stage={stage} style={style} part={part} ready={ready} fill />
        </FitArea>
        {caption && (
          <div
            className={`pointer-events-none absolute inset-x-0 ${
              style.captionPosition === 'top' ? 'top-[3%]' : 'bottom-[3%]'
            }`}
          >
            {caption}
          </div>
        )}
        {part === 'auto' && <ChoiceOverlay stage={stage} />}
      </Page>
    )
  }

  return (
    <Page style={style}>
      {style.captionPosition === 'top' && caption && <div className="mb-[2%]">{caption}</div>}
      <FitArea>
        <StageContent stage={stage} style={style} part={part} ready={ready} />
      </FitArea>
      {style.captionPosition === 'bottom' && caption && <div className="mt-[2%]">{caption}</div>}
      {part === 'auto' && <ChoiceOverlay stage={stage} />}
    </Page>
  )
}

/** The menu of the running step, over whatever is on stage. Clickable with the token. */
const ChoiceOverlay = ({ stage }: { stage: StagePayload | null }): React.JSX.Element | null => {
  const authorized = useConnection((s) => s.authorized)
  const choice = stage?.choice
  if (!choice) return null
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
      <div className="caption-in min-w-[40%] max-w-[80%] rounded-3xl bg-[#0f172a]/95 p-[2.5%] text-white shadow-2xl">
        {choice.title && (
          <div className="mb-[4%] text-center text-[52px] font-semibold">{choice.title}</div>
        )}
        <div className="flex flex-col gap-5">
          {choice.options.map((option, i) => (
            <button
              key={i}
              disabled={!authorized}
              onClick={() => sendCommand({ command: 'choose', value: i })}
              className="flex items-center gap-6 rounded-2xl bg-white/10 px-8 py-5 text-left text-[40px] enabled:hover:bg-fuchsia-700"
            >
              <span className="rounded-xl bg-fuchsia-600 px-4 font-mono text-[34px]">{i + 1}</span>
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Caption alone on a transparent page (?posicao=topo to place it at the top). */
const CaptionPage = (): React.JSX.Element => {
  const style = usePresentationStyle()
  const stage = useStage()
  const top = PARAMS.get('posicao') === 'topo'
  return (
    <div className={`flex h-full w-full flex-col p-[3%] ${top ? 'justify-start' : 'justify-end'}`}>
      <Caption
        text={stage?.caption ?? ''}
        size={Number(PARAMS.get('tamanho')) || style.captionSize}
      />
    </div>
  )
}

/** Thin progress bar with the current step, transparent page. */
const ProgressPage = (): React.JSX.Element => {
  const stage = useStage()
  if (!stage || stage.stepTotal === 0) return <div />
  const progress = stage.stepNumber / stage.stepTotal
  return (
    <div className="flex h-full w-full flex-col justify-end p-[2%]">
      <div className="caption-in rounded-xl bg-black/65 px-5 py-3 text-white shadow-xl backdrop-blur">
        <div className="flex items-baseline gap-3 text-[22px]">
          <span className="font-semibold tabular-nums">
            Passo {Math.max(stage.stepNumber, 0)}/{stage.stepTotal}
          </span>
          <span className="truncate opacity-80">
            {stage.flowTitle && `${stage.flowTitle} · `}
            {stage.stepTitle}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-400 transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

const OverlayApp = (): React.JSX.Element => {
  const page = pageName()
  const fullscreen = !['aluno', 'apresentador'].includes(page)

  // Buttons of HTML slides (proximoPasso / rodarComando) work on pages opened with the token.
  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (!useConnection.getState().authorized) return
      const fromSlide = [...document.querySelectorAll('iframe')].some(
        (frame) => frame.contentWindow === event.source && /\/slides\/[0-9a-f]+$/.test(frame.src)
      )
      if (!fromSlide) return
      const data = event.data as { ssc?: string; value?: unknown; terminal?: unknown }
      if (
        data?.ssc === 'proximoPasso' &&
        (typeof data.value === 'number' || typeof data.value === 'string')
      ) {
        sendCommand({ command: 'choose', value: data.value })
      } else if (data?.ssc === 'rodarComando' && typeof data.value === 'string' && data.value) {
        sendCommand({
          command: 'run',
          value: data.value,
          terminal: typeof data.terminal === 'string' ? data.terminal : undefined
        })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('no-scroll', fullscreen)
    document.title =
      {
        aluno: 'Aula ao vivo',
        apresentador: 'Visão do apresentador'
      }[page] ?? `Step-by-Step Code — ${page}`
  }, [page, fullscreen])

  switch (page) {
    case 'codigo':
      return <StagePage part="code" />
    case 'terminal':
      return <StagePage part="terminal" />
    case 'slide':
      return <StagePage part="slide" />
    case 'legenda':
      return <CaptionPage />
    case 'progresso':
      return <ProgressPage />
    case 'aluno':
      return <StudentPage />
    case 'apresentador':
      return <PresenterPage />
    default:
      return <StagePage part="auto" />
  }
}

export default OverlayApp
