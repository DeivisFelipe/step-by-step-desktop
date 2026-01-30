import { Handle, Position, NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import { Play } from 'lucide-react';

export const StartNode = ({ data, selected }: NodeProps) => {
  return (
    <div className={clsx(
       "w-12 h-12 rounded-full bg-green-600 border-2 flex items-center justify-center shadow-lg",
       selected ? "border-white" : "border-green-800"
    )}>
       <Play size={20} className="text-white ml-1" fill="currentColor" />
       
       <Handle type="source" position={Position.Top} id="t" className="w-3 h-3 !bg-green-400" />
       <Handle type="source" position={Position.Bottom} id="b" className="w-3 h-3 !bg-green-400" />
       <Handle type="source" position={Position.Left} id="l" className="w-3 h-3 !bg-green-400" />
       <Handle type="source" position={Position.Right} id="r" className="w-3 h-3 !bg-green-400" />
    </div>
  );
};
