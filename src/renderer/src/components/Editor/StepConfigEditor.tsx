import { useLessonStore } from '../../store/useLessonStore';
import { ActionType, StepData } from '../../types/schema';
import { Play } from 'lucide-react';
import { useExecutionEngine } from '../../engine/ExecutionEngine';
import { useIDEContext } from '../../context/IDEContext';

export interface StepConfigEditorProps {
  stepId: string;
}

const StepConfigEditor = ({ stepId }: StepConfigEditorProps) => {
  const { tree, updateNode } = useLessonStore();
  const { executeStep } = useExecutionEngine();
  const context = useIDEContext();

  const findNode = (nodes: any[], id: string): any => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found; 
      }
    }
    return null;
  };

  const selectedNode = findNode(tree, stepId);

  if (!selectedNode) return <div>Step not found</div>;

  const data = selectedNode.data || {
    enableSnapshot: false,
    action: { kind: 'FILE', operation: 'APPEND', content: '', targetMode: 'ACTIVE_FILE', config: { typingAnimation: true } }
  } as StepData;

  const handleChange = (partialData: Partial<StepData>) => {
    updateNode(stepId, { data: { ...data, ...partialData } });
  };

  const handleActionChange = (partialAction: Partial<ActionType>) => {
    handleChange({ action: { ...data.action, ...partialAction } as ActionType });
  };

  const handleTestRun = () => {
     executeStep(stepId, data, {
        editorInstance: context.editorRef.current,
        terminalInstance: context.terminalRef.current
     });
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300 p-6 overflow-y-auto">
       <div className="flex justify-between items-center mb-6 pb-2 border-b border-[#3e3e42]">
          <h1 className="text-2xl font-light">{selectedNode.title}</h1>
          <button 
             onClick={handleTestRun}
             className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-4 py-1.5 rounded"
          >
             <Play size={16} /> Run Step
          </button>
       </div>

       <div className="space-y-6 max-w-4xl">
           <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-400">Title</label>
              <input 
                 className="bg-[#2d2d2d] border border-[#3e3e42] p-2 rounded focus:border-blue-500 outline-none"
                 value={selectedNode.title}
                 onChange={(e) => updateNode(stepId, { title: e.target.value })}
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                 <label className="text-sm font-bold text-gray-400">Action Type</label>
                 <select 
                   className="bg-[#2d2d2d] border border-[#3e3e42] p-2 rounded outline-none"
                   value={data.action.kind}
                   onChange={(e) => handleActionChange({ kind: e.target.value as any })}
                 >
                   <option value="FILE">File Operation</option>
                   <option value="TERMINAL">Terminal Command</option>
                 </select>
              </div>
           </div>

           {data.action.kind === 'FILE' && (
              <div className="p-4 bg-[#252526] rounded border border-[#3e3e42] space-y-4">
                  <h3 className="text-xs uppercase font-bold tracking-wider mb-2 text-blue-400">File Configuration</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500">Operation</label>
                        <select 
                          className="bg-[#2d2d2d] border border-[#3e3e42] p-2 rounded text-sm outline-none"
                          value={(data.action as any).operation}
                          onChange={(e) => handleActionChange({ operation: e.target.value as any })}
                        >
                          <option value="CREATE">Create New File</option>
                          <option value="APPEND">Append to File</option>
                          <option value="OVERWRITE">Overwrite File</option>
                          <option value="CURSOR_POSITION">Insert at Cursor</option>
                        </select>
                     </div>
                     <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500">Target</label>
                        <select 
                          className="bg-[#2d2d2d] border border-[#3e3e42] p-2 rounded text-sm outline-none"
                          value={(data.action as any).targetMode}
                          onChange={(e) => handleActionChange({ targetMode: e.target.value as any })}
                        >
                           <option value="ACTIVE_FILE">Active Editor File</option>
                           <option value="SPECIFIC_PATH">Specific Path</option>
                        </select>
                     </div>
                  </div>

                  {/* SPECIFIC PATH OR CREATE needs filename */}
                  {((data.action as any).targetMode === 'SPECIFIC_PATH' || (data.action as any).operation === 'CREATE') && (
                     <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500">
                           {(data.action as any).operation === 'CREATE' ? 'New Filename (e.g. src/utils.ts)' : 'Target Path'}
                        </label>
                        <input 
                           className="bg-[#2d2d2d] border border-[#3e3e42] p-2 rounded text-sm font-mono outline-none"
                           value={(data.action as any).targetPath || ''}
                           onChange={(e) => handleActionChange({ targetPath: e.target.value })}
                           placeholder="path/to/file.ext"
                        />
                     </div>
                  )}

                  {/* Language Selector (New) */}
                  <div className="flex flex-col gap-2">
                     <label className="text-xs font-bold text-gray-500">Language (Simulated)</label>
                     <select 
                       className="bg-[#2d2d2d] border border-[#3e3e42] p-2 rounded text-sm outline-none"
                       // We don't store language in action currently, maybe infer or add field?
                       // User requested selector. Let's add to 'config' or just rely on extension.
                       // Actually schema says `FileContent` has language. `FileAction` doesn't explicitly.
                       // Let's assume automatic from extension but provide a selector if needed?
                       // Or maybe this selector is for highlighter in the block below?
                       defaultValue="typescript" 
                     >
                        <option value="typescript">TypeScript</option>
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="html">HTML</option>
                        <option value="css">CSS</option>
                        <option value="json">JSON</option>
                     </select>
                  </div>

                  <div className="flex flex-col gap-2">
                     <label className="text-xs font-bold text-gray-500">Code Content</label>
                     <textarea 
                        className="bg-[#1e1e1e] border border-[#3e3e42] p-2 rounded font-mono text-sm h-48 outline-none"
                        value={(data.action as any).content}
                        onChange={(e) => handleActionChange({ content: e.target.value })}
                     />
                  </div>
              </div>
           )}

           {data.action.kind === 'TERMINAL' && (
              <div className="p-4 bg-[#252526] rounded border border-[#3e3e42] space-y-4">
                 <h3 className="text-xs uppercase font-bold tracking-wider mb-2 text-purple-400">Terminal Configuration</h3>
                 <div className="flex flex-col gap-2">
                     <label className="text-xs font-bold text-gray-500">Command</label>
                     <input 
                        className="bg-[#2d2d2d] border border-[#3e3e42] p-2 rounded font-mono text-sm outline-none"
                        value={(data.action as any).command}
                        onChange={(e) => handleActionChange({ command: e.target.value })}
                     />
                 </div>
                 <div className="flex items-center gap-2">
                     <input 
                        type="checkbox" 
                        checked={(data.action as any).executeImmediately}
                        onChange={(e) => handleActionChange({ executeImmediately: e.target.checked })}
                     />
                     <label className="text-sm">Execute Immediately</label>
                 </div>
              </div>
           )}
       </div>
    </div>
  );
};

export default StepConfigEditor;
