import { useLessonStore } from '../../store/useLessonStore';
import { StepTree } from './StepTree';
import { ChevronLeft, ChevronRight, Play, FolderPlus, FilePlus } from 'lucide-react';
import { useState } from 'react';
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu';
import clsx from 'clsx';

const LessonSteps = () => {
  const { tree, selectNode, selectedNodeId, addNode } = useLessonStore();
  const [menu, setMenu] = useState<{ x: number, y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems: ContextMenuItem[] = [
      { label: 'New Flow', icon: FolderPlus, action: () => addNode(null, 'FLOW', 'New Flow') },
      { label: 'New Step', icon: FilePlus, action: () => addNode(null, 'STEP', 'New Step') },
  ];

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc]" onClick={() => selectNode(null)}>
       <div 
         className={clsx(
            "px-5 py-2 text-xs font-bold tracking-wider uppercase flex justify-between items-center cursor-pointer hover:bg-[#2a2d2e]",
            selectedNodeId === 'root' && "bg-[#37373d] text-white" 
         )}
         onClick={(e) => {
             e.stopPropagation();
             selectNode('root'); 
         }}
         onContextMenu={handleContextMenu}
       >
          <span className="truncate">Step by Step Code</span>
       </div>
       
       <div className="flex-1 overflow-y-auto">
          <StepTree nodes={tree} />
       </div>

       <ContextMenu 
          position={menu} 
          items={menuItems} 
          onClose={() => setMenu(null)} 
       />
    </div>
  );
};

export default LessonSteps;
