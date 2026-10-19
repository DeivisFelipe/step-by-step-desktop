import { Handle, Node, Position } from '@xyflow/react'
import { Play } from 'lucide-react'

export type StartFlowNode = Node<Record<string, never>, 'start'>

export const StartNode = (): React.JSX.Element => {
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-800 bg-green-600 shadow-lg"
      title="Início do fluxo"
    >
      <Play size={20} className="ml-1 text-white" fill="currentColor" />
      <Handle type="source" position={Position.Right} id="r" className="!h-3 !w-3 !bg-green-400" />
    </div>
  )
}
