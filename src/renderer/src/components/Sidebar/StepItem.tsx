import { useState } from 'react';
import { LessonNode } from '../../types/schema';
import { useLessonStore } from '../../store/useLessonStore';
import { useIDEStore } from '../../store/useIDEStore';
import { ChevronRight, ChevronDown, FileCode, Terminal, Folder, ArrowUp, ArrowDown, Trash, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu';

interface StepItemProps {
  node: LessonNode;
  depth: number;
  onExecute: (node: LessonNode) => void;
}

const StepItem = ({ node, depth, onExecute }: StepItemProps) => {
  const { selectNode, selectedNodeId, updateNode, reorderNode, removeNode, lastExecutedStepId } = useLessonStore();
  const { openTab } = useIDEStore();
  
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);

  const isSelected = selectedNodeId === node.id;
  const isExpanded = node.isExpanded;
  const isLastExecuted = lastExecutedStepId === node.id;
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNode(node.id, { isExpanded: !isExpanded });
  };
  
  const handleClick = () => {
    selectNode(node.id);
    openTab({
       id: node.id,
       type: node.type === 'STEP' ? 'STEP' : 'FLOW',
       title: node.title,
       stepId: node.id
    });
  };
  
  const handleDoubleClick = () => {
    if (node.type === 'STEP') {
      onExecute(node);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const menuItems: ContextMenuItem[] = [
    { label: 'Move Up', icon: ArrowUp, action: () => reorderNode(node.id, 'up') },
    { label: 'Move Down', icon: ArrowDown, action: () => reorderNode(node.id, 'down') },
    { label: 'Delete', icon: Trash, danger: true, action: () => removeNode(node.id) }
  ];

  const style = {
    paddingLeft: `${depth * 16 + 8}px`
  };

  return (
    <>
      <div 
        style={style} 
        className={clsx(
          "flex items-center py-1 pr-2 cursor-pointer hover:bg-gray-700 transition-colors group select-none relative",
          isSelected && "bg-blue-900 border-l-2 border-blue-400"
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <span 
          className="mr-1 p-0.5 rounded hover:bg-gray-600"
          onClick={handleToggle}
        >
          {node.type === 'FLOW' && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
          {node.type === 'STEP' && <div className="w-4" />} {/* Spacer */}
        </span>
        
        <span className="mr-2 text-gray-400">
          {node.type === 'FLOW' ? <Folder size={16} /> : (
            node.data?.action?.kind === 'TERMINAL' ? <Terminal size={16} /> : <FileCode size={16} />
          )}
        </span>
        
        <span className="text-sm text-gray-200 truncate flex-1">{node.title}</span>

        {isLastExecuted && (
           <span className="text-green-500 ml-2">
             <CheckCircle size={14} />
           </span>
        )}
      </div>

      <ContextMenu 
        position={contextMenuPos} 
        items={menuItems} 
        onClose={() => setContextMenuPos(null)} 
      />
    
      {node.type === 'FLOW' && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <StepItem key={child.id} node={child} depth={depth + 1} onExecute={onExecute} />
          ))}
        </div>
      )}
    </>
  );
};

export default StepItem;
