import { useEffect } from 'react'
import { PresentationStyle, StagePayload } from '../../shared/presentation'
import { ChallengeView, Markdown, SlideView } from '../common/StageViews'
import { PARAMS, useConnection } from './connection'
import { usePresentationStyle, useStage } from './style'
import { AppWindow, Page } from './Frame'
import { useFitBox } from './useFitBox'
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
      className="caption-in mx-auto max-w-[90%] rounded-2xl bg-black/65 px-[1.1em] py-[0.6em] text-center text-white shadow-2xl backdrop-blur"
      style={{ fontSize: size }}
    >
      <Markdown source={text} />
    </div>
  )
}

/** A box with the style's aspect ratio, filling the space left on the page. */
const FitArea = ({
  style,
  children
}: {
  style: PresentationStyle
  children: React.ReactNode
}): React.JSX.Element => {
  const { ref, size } = useFitBox(style.aspect)
  return (
    <div ref={ref} className="flex min-h-0 w-full flex-1 items-center justify-center">
      {size && <div style={{ width: size.width, height: size.height }}>{children}</div>}
    </div>
  )
}

const Card = ({
  style,
  bg,
  fg,
  children
}: {
  style: PresentationStyle
  bg: string
  fg: string
  children: React.ReactNode
}): React.JSX.Element => (
  <div
    className="h-full w-full overflow-hidden"
    style={{
      background: bg,
      color: fg,
      borderRadius: style.radius,
      boxShadow: style.shadow ? '0 30px 80px rgba(0,0,0,0.45)' : 'none'
    }}
  >
    {children}
  </div>
)

type Part = 'code' | 'terminal' | 'slide' | 'auto'

/** The window with whatever `part` shows (or the current stage view for "auto"). */
const StageContent = ({
  stage,
  style,
  part,
  ready
}: {
  stage: StagePayload | null
  style: PresentationStyle
  part: Part
  ready: ReadyHighlighter | null
}): React.JSX.Element | null => {
  const bg = ready?.bg ?? '#1e1e1e'
  const fg = ready?.fg ?? '#d4d4d4'
  const clockOffset = useConnection((s) => s.clockOffset)
  const view =
    part === 'auto'
      ? (stage?.view ?? 'code')
      : part === 'slide'
        ? stage?.view === 'challenge' || (!stage?.slide && stage?.challenge)
          ? 'challenge'
          : 'slide'
        : part

  if (view === 'slide' || view === 'challenge') {
    const content =
      view === 'slide' && stage?.slide ? (
        <SlideView slide={stage.slide} fontSize={style.fontSize * 1.1} />
      ) : view === 'challenge' && stage?.challenge ? (
        <ChallengeView
          challenge={stage.challenge}
          fontSize={style.fontSize * 1.1}
          clockOffset={clockOffset}
        />
      ) : null
    if (!content) return null
    return (
      <Card style={style} bg={bg} fg={fg}>
        <div key={view} className="fade-in h-full w-full">
          {content}
        </div>
      </Card>
    )
  }

  if (view === 'terminal') {
    return (
      <AppWindow style={style} title={stage?.terminalName || 'Terminal'} bg={bg} fg={fg}>
        <TerminalContent
          terminalId={stage?.terminalId ?? null}
          fontSize={Math.round(style.fontSize * 0.8)}
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
  const style = usePresentationStyle()
  const stage = useStage()
  const ready = useHighlighter(style.theme, stage?.code?.language ?? 'text')
  const showCaption = part === 'auto' && style.captionPosition !== 'none'
  const caption = showCaption ? (
    <Caption text={stage?.caption ?? ''} size={style.captionSize} />
  ) : null

  return (
    <Page style={style}>
      {style.captionPosition === 'top' && caption && <div className="mb-[2%]">{caption}</div>}
      <FitArea style={style}>
        <StageContent stage={stage} style={style} part={part} ready={ready} />
      </FitArea>
      {style.captionPosition === 'bottom' && caption && <div className="mt-[2%]">{caption}</div>}
    </Page>
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
