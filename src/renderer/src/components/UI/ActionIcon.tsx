import {
  CornerDownRight,
  FlaskConical,
  Signpost,
  Split,
  Clapperboard,
  FileCode,
  Globe,
  Highlighter,
  Hourglass,
  Presentation,
  Terminal,
  Trophy
} from 'lucide-react'
import { ActionKind } from '../../types/schema'

const ICONS: Record<ActionKind, [typeof FileCode, string]> = {
  FILE: [FileCode, 'text-sky-400'],
  TERMINAL: [Terminal, 'text-purple-400'],
  WAIT: [Hourglass, 'text-amber-300'],
  SLIDE: [Presentation, 'text-emerald-400'],
  HIGHLIGHT: [Highlighter, 'text-yellow-300'],
  CHALLENGE: [Trophy, 'text-orange-400'],
  PREVIEW: [Globe, 'text-cyan-300'],
  OBS_SCENE: [Clapperboard, 'text-rose-400'],
  CHOICE: [Signpost, 'text-fuchsia-400'],
  CONDITION: [Split, 'text-amber-400'],
  GOTO: [CornerDownRight, 'text-gray-300'],
  LAB: [FlaskConical, 'text-lime-400']
}

export const ActionIcon = ({
  kind,
  size = 16
}: {
  kind: ActionKind
  size?: number
}): React.JSX.Element => {
  const [Icon, color] = ICONS[kind]
  return <Icon size={size} className={`flex-none ${color}`} />
}
