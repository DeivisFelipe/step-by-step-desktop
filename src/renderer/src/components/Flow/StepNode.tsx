import { Handle, Position, NodeProps } from '@xyflow/react';
import clsx from 'clsx';

export const StepNode = ({ data, selected }: NodeProps) => {
  return (
    <div className={clsx(
       "px-4 py-2 shadow-md rounded-md bg-[#1e1e1e] border-2 min-w-[150px] text-center",
       selected ? "border-blue-500" : "border-[#3e3e42]"
    )}>
       <div className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">Step</div>
       <div className="text-sm font-medium text-white">{data.label as string}</div>

       {/* Top */}
       <Handle type="target" position={Position.Top} id="t" className="w-2 h-2 !bg-blue-500" />
       
       {/* Bottom */}
       <Handle type="source" position={Position.Bottom} id="b" className="w-2 h-2 !bg-blue-500" />
       
       {/* Left */}
       <Handle type="target" position={Position.Left} id="l" className="w-2 h-2 !bg-blue-500" />
       
       {/* Right */}
       <Handle type="source" position={Position.Right} id="r" className="w-2 h-2 !bg-blue-500" />
    </div>
  );
};
