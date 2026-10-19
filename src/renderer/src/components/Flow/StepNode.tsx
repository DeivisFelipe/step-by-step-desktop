import { Handle, Node, NodeProps, Position } from '@xyflow/react'
import clsx from 'clsx'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { ActionKind } from '../../types/schema'
import { ActionIcon } from '../UI/ActionIcon'

export type StepNodeData = {
  title: string
  subtitle: string
  number: number
  kind: ActionKind
  actions: number
  executed: boolean
  next: boolean
  running: boolean
}

export type StepFlowNode = Node<StepNodeData, 'step'>

export const StepNode = ({ data, selected }: NodeProps<StepFlowNode>): React.JSX.Element => {
  return (
    <div
      className={clsx(
        'w-[190px] rounded-md border-2 bg-ide-panel px-3 py-2 shadow-md transition-colors',
        selected
          ? 'border-ide-accent'
          : data.next
            ? 'border-sky-700'
            : data.executed
              ? 'border-green-800'
              : 'border-ide-border'
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        <ActionIcon kind={data.kind} size={12} />
        <span>Passo {data.number}</span>
        {data.actions > 1 && (
          <span className="normal-case text-ide-muted">· {data.actions} ações</span>
        )}
        <span className="flex-1" />
        {data.running ? (
          <Loader2 size={12} className="animate-spin text-sky-400" />
        ) : (
          data.executed && <CheckCircle2 size={12} className="text-green-500" />
        )}
      </div>
      <div className="truncate text-[13px] font-medium text-white" title={data.title}>
        {data.title}
      </div>
      <div className="truncate font-mono text-[10px] text-ide-muted" title={data.subtitle}>
        {data.subtitle}
      </div>

      <Handle type="target" position={Position.Left} id="l" className="!h-2.5 !w-2.5 !bg-sky-500" />
      <Handle
        type="source"
        position={Position.Right}
        id="r"
        className="!h-2.5 !w-2.5 !bg-sky-500"
      />
    </div>
  )
}
