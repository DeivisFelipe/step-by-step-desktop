import { BUILTIN_PRESETS, PresentationStyle, StagePayload } from '../../shared/presentation'
import { PARAMS, useConnection } from './connection'

/** Style for this page: ?estilo=Name, else the preset chosen in the app. */
export function usePresentationStyle(): PresentationStyle {
  const presentation = useConnection((s) => s.presentation)
  const requested = PARAMS.get('estilo')
  if (!presentation) return BUILTIN_PRESETS[requested ?? ''] ?? BUILTIN_PRESETS.Carbon
  return (
    (requested ? presentation.presets[requested] : undefined) ??
    presentation.presets[presentation.preset] ??
    BUILTIN_PRESETS.Carbon
  )
}

const DEMO_CODE = `function soma(a, b) {
  return a + b
}

const resultado = soma(2, 3)
console.log(\`2 + 3 = \${resultado}\`)
`

/** Sample content for style previews (?demo=1) when nothing is on stage yet. */
export function useStage(): StagePayload | null {
  const stage = useConnection((s) => s.stage)
  if (!PARAMS.has('demo') || stage?.code) return stage
  return {
    lessonTitle: 'Aula de exemplo',
    flowTitle: 'Funções',
    stepTitle: 'Criar a função soma',
    stepNumber: 2,
    stepTotal: 5,
    view: 'code',
    code: {
      path: 'src/app.js',
      language: 'javascript',
      content: DEMO_CODE,
      highlight: null,
      cursorLine: 6,
      transition: 'none',
      version: 1
    },
    terminalId: null,
    terminalName: '',
    slide: null,
    challenge: null,
    preview: null,
    caption: 'Uma **função** recebe parâmetros e devolve um resultado.',
    choice: null,
    lab: null,
    running: false
  }
}
