import { Handle, Node, NodeProps, Position } from '@xyflow/react'
import clsx from 'clsx'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { ActionKind } from '../../types/schema'
import { ActionIcon } from '../UI/ActionIcon'

/** One way out of the step (menu option, condition, go to), drawn as a handle. */
export interface StepNodeBranch {
  handle: string
  kind: 'CHOICE' | 'CONDITION' | 'GOTO'
  label: string
  /** Target outside this flow ("→ 7. Title"); it can't be drawn as a link. */
  outside?: string
  linked: boolean
}

export type StepNodeData = {
  title: string
  subtitle: string
  number: number
  kind: ActionKind
  actions: number
  executed: boolean
  next: boolean
  running: boolean
  branches: StepNodeBranch[]
}

export type StepFlowNode = Node<StepNodeData, 'step'>

const BRANCH_COLOR: Record<StepNodeBranch['kind'], string> = {
  CHOICE: '!bg-fuchsia-400',
  CONDITION: '!bg-amber-400',
  GOTO: '!bg-gray-400'
}

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

      {data.branches.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-ide-border pt-1.5">
          {data.branches.map((branch) => (
            <div
              key={branch.handle}
              className="relative pr-1 text-[10px] leading-tight text-gray-300"
              title={branch.outside ?? branch.label}
            >
              <div className="truncate">{branch.label}</div>
              {branch.outside ? (
                <div className="truncate text-sky-400">{branch.outside}</div>
              ) : (
                !branch.linked && <div className="text-ide-muted">→ próximo da lista</div>
              )}
              <Handle
                type="source"
                position={Position.Right}
                id={branch.handle}
                className={clsx('!-right-[17px] !h-2.5 !w-2.5', BRANCH_COLOR[branch.kind])}
              />
            </div>
          ))}
        </div>
      )}

      <Handle type="target" position={Position.Left} id="l" className="!h-2.5 !w-2.5 !bg-sky-500" />
      {/* Paths arrive from above, so they arc over the cards in between. */}
      <Handle
        type="target"
        position={Position.Top}
        id="t"
        className="!h-2 !w-2 !border-0 !bg-transparent"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="r"
        style={{ top: 22 }}
        className="!h-2.5 !w-2.5 !bg-sky-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="jump"
        title="Puxe até outro passo para criar um “ir para”"
        className="!h-2 !w-2 !bg-gray-500"
      />
    </div>
  )
}
