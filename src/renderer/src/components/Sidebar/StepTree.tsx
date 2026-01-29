import { useLessonStore } from '../../store/useLessonStore';
import StepItem from './StepItem';
import { Plus, FolderPlus } from 'lucide-react';
import { useExecutionEngine } from '../../engine/ExecutionEngine';
import { useIDEContext } from '../../context/IDEContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo } from 'react';

const StepTree = () => {
  const { tree, addNode, selectedNodeId, moveNode } = useLessonStore();
  const { executeStep } = useExecutionEngine();
  const context = useIDEContext(); // Context contains refs
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );
  
  const handleExecute = (node: any) => {
    // If it's a step, execute it
    if (node.type === 'STEP' && node.data) {
      executeStep(node.id, node.data, {
        editorInstance: context.editorRef.current,
        terminalInstance: context.terminalRef.current
      });
    }
  };

  const handleAddFlow = () => {
    addNode(selectedNodeId, 'FLOW');
  };

  const handleAddStep = () => {
    addNode(selectedNodeId, 'STEP');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
       moveNode(active.id as string, over.id as string);
    }
  };
  
  // Flatten tree for SortableContext?
  // Use a recursive strategy or just list IDs if we assume flat drag for now.
  // Real tree DnD is complex (nesting).
  // For MVP, let's just make all visible items sortable in a flattened list?
  // But our StepItem renders recursively.
  
  // Strategy: Collect all visible Node IDs for SortableContext.
  // The items themselves handle recursion but SortableContext needs a list of all *currently rendered* sortable IDs.
  
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
    <div className="flex flex-col h-full bg-[#252526] text-white border-r border-[#3e3e42]">
      <div className="p-2 flex justify-between items-center bg-[#333333] border-b border-[#3e3e42]">
        <span className="font-semibold text-xs tracking-wider uppercase">Outline</span>
        <div className="flex gap-1">
          <button onClick={handleAddFlow} title="Add Flow" className="p-1 hover:bg-gray-600 rounded">
            <FolderPlus size={14} />
          </button>
          <button onClick={handleAddStep} title="Add Step" className="p-1 hover:bg-gray-600 rounded">
            <Plus size={14} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
           <SortableContext 
              items={visibleIds}
              strategy={verticalListSortingStrategy}
           >
              {tree.map(node => (
                <StepItem key={node.id} node={node} depth={0} onExecute={handleExecute} />
              ))}
           </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default StepTree;
