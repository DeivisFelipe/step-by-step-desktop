import { useLessonStore } from '../../store/useLessonStore';
import StepItem from './StepItem'; // Reuse mostly, might need tweaks
import { FolderPlus, Plus, Play, ChevronRight, ChevronLeft } from 'lucide-react';
import { useExecutionEngine } from '../../engine/ExecutionEngine';
import { useIDEContext } from '../../context/IDEContext';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, KeyboardSensor, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo } from 'react';

// import { useIDEStore } from '../../store/useIDEStore';

const LessonSteps = () => {
  const { tree, addNode, selectedNodeId, moveNode } = useLessonStore();
  const { executeStep } = useExecutionEngine();
  const context = useIDEContext();
  /* const handleNodeClick = (node: any) => ... moved to StepItem */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleExecute = (node: any) => {
    if (node.type === 'STEP' && node.data) {
      executeStep(node.id, node.data, {
        editorInstance: context.editorRef.current,
        terminalInstance: context.terminalRef.current
      });
    }
  };


  const handleNextStep = () => {
    // Logic to find next step in tree and execute it
    // Flatten tree -> Find current index -> Execute index + 1
    // For MVP: Simple traversal
    // We need a helper "findNextStep(currentId)"
    console.log("Next step logic needed");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
       moveNode(active.id as string, over.id as string);
    }
  };
  
  const getAllVisibleIds = (nodes: any[]): string[] => {
     let ids: string[] = [];
     for (const node of nodes) {
        ids.push(node.id);
        if (node.isExpanded && node.children) {
           ids = [...ids, ...getAllVisibleIds(node.children)];
        }
     }
     return ids;
  };
  
  const visibleIds = useMemo(() => getAllVisibleIds(tree), [tree]);

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc]">
       <div className="px-4 py-2 text-xs font-bold tracking-wider uppercase flex justify-between items-center border-b border-[#252526]">
          <span>Lesson Steps</span>
          <div className="flex gap-1">
             <button onClick={() => addNode(selectedNodeId, 'FLOW')} title="New Flow" className="p-1 hover:bg-[#3e3e42] rounded"><FolderPlus size={14}/></button>
             <button onClick={() => addNode(selectedNodeId, 'STEP')} title="New Step" className="p-1 hover:bg-[#3e3e42] rounded"><Plus size={14}/></button>
          </div>
       </div>

       {/* Step Controller */}
       <div className="p-2 border-b border-[#252526] flex gap-2 justify-center bg-[#1e1e1e]">
          <button className="p-1 rounded hover:bg-[#3e3e42]" title="Previous"><ChevronLeft size={16}/></button>
          <button className="flex items-center gap-1 bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-white text-xs font-bold" onClick={handleNextStep}>
             <Play size={12} fill="currentColor" /> Next Step
          </button>
          <button className="p-1 rounded hover:bg-[#3e3e42]" title="Next"><ChevronRight size={16}/></button>
       </div>
       
       <div className="flex-1 overflow-y-auto py-2">
         <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
           <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
              {tree.map(node => (
                <StepItem key={node.id} node={node} depth={0} onExecute={handleExecute} />
              ))}
           </SortableContext>
         </DndContext>
       </div>
    </div>
  );
};

export default LessonSteps;
