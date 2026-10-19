import { useState } from 'react'
import { ExternalLink, RotateCw } from 'lucide-react'
import { useStageStore } from '../../store/useStageStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { resolveStyle } from '../../../../shared/presentation'
import { ChallengeView, SlideView } from '../../../common/StageViews'

const Empty = ({ text }: { text: string }): React.JSX.Element => (
  <div className="flex h-full items-center justify-center text-sm text-ide-muted">{text}</div>
)

/** Background of the current presentation style, so the IDE looks like the stage. */
function useStageBackground(): string {
  const settings = useSettingsStore((s) => s.settings)
  const style = resolveStyle(settings)
  return style.transparent ? 'linear-gradient(135deg, #1f2937, #111827)' : style.background
}

export const SlideTab = (): React.JSX.Element => {
  const slide = useStageStore((s) => s.slide)
  const background = useStageBackground()
  if (!slide) return <Empty text="Nenhum slide em exibição." />
  return (
    <div className="h-full w-full text-white" style={{ background }}>
      <SlideView slide={slide} fontSize={30} />
    </div>
  )
}

export const ChallengeTab = (): React.JSX.Element => {
  const challenge = useStageStore((s) => s.challenge)
  const background = useStageBackground()
  if (!challenge) return <Empty text="Nenhum desafio em andamento." />
  return (
    <div className="h-full w-full text-white" style={{ background }}>
      <ChallengeView challenge={challenge} fontSize={28} />
    </div>
  )
}

export const PreviewTab = (): React.JSX.Element => {
  const preview = useStageStore((s) => s.preview)
  const [reloadKey, setReloadKey] = useState(0)
  if (!preview) return <Empty text="Nenhuma página em preview." />
  const button = 'rounded p-1 text-gray-400 hover:bg-ide-border hover:text-white'
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 flex-none items-center gap-2 border-b border-ide-border bg-ide-panel px-2">
        <button className={button} title="Recarregar" onClick={() => setReloadKey((k) => k + 1)}>
          <RotateCw size={14} />
        </button>
        <span className="flex-1 truncate font-mono text-[12px] text-gray-400">{preview}</span>
        <button
          className={button}
          title="Abrir no navegador"
          onClick={() => window.open(preview, '_blank')}
        >
          <ExternalLink size={14} />
        </button>
      </div>
      <iframe key={reloadKey} src={preview} className="min-h-0 flex-1 bg-white" title="Preview" />
    </div>
  )
}
