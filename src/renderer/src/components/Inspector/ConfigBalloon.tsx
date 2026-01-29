import { useState, useEffect } from 'react';
import { useLessonStore } from '../../store/useLessonStore';
import { Settings, X, Save } from 'lucide-react';
import clsx from 'clsx';
import { LessonNode } from '../../types/schema';

const ConfigBalloon = () => {
   const { selectedNodeId, tree, updateNode } = useLessonStore();
   const [isOpen, setIsOpen] = useState(true);
   const [node, setNode] = useState<LessonNode | null>(null);
   const [formData, setFormData] = useState<{ title: string; description: string }>({ title: '', description: '' });

   // Find selected node in tree (recursive)
   const findNode = (nodes: LessonNode[], id: string): LessonNode | null => {
      for (const n of nodes) {
         if (n.id === id) return n;
         if (n.children) {
            const found = findNode(n.children, id);
            if (found) return found;
         }
      }
      return null;
   };

   useEffect(() => {
      if (selectedNodeId) {
         const found = findNode(tree, selectedNodeId);
         setNode(found);
         if (found) {
            setFormData({ 
               title: found.title, 
               description: (found as any).description || '' 
            });
            setIsOpen(true); // Auto open on select?
         }
      } else {
         setNode(null);
      }
   }, [selectedNodeId, tree]);

   const handleSave = () => {
      if (node && selectedNodeId) {
         updateNode(selectedNodeId, { 
            title: formData.title,
            // @ts-ignore - dynamic property
            description: formData.description 
         });
      }
   };

   if (!node) return null;

   return (
      <div className={clsx(
         "fixed top-12 right-4 z-40 bg-[#252526] border border-[#3e3e42] shadow-xl rounded-lg transition-all duration-300 flex flex-col",
         isOpen ? "w-80 h-auto" : "w-10 h-10 overflow-hidden rounded-full cursor-pointer hover:bg-[#3e3e42]"
      )}>
         {/* Check if minimized for toggle */}
         {!isOpen && (
            <div className="flex items-center justify-center h-full w-full" onClick={() => setIsOpen(true)}>
               <Settings size={20} className="text-gray-400" />
            </div>
         )}

         {/* Header */}
         {isOpen && (
            <div className="flex items-center justify-between p-3 border-b border-[#3e3e42] bg-[#2d2d30] rounded-t-lg">
               <span className="text-xs font-bold uppercase text-gray-400 flex items-center">
                  <Settings size={14} className="mr-2" />
                  Configuration
               </span>
               <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={14} />
               </button>
            </div>
         )}

         {/* Body */}
         {isOpen && (
            <div className="p-4 space-y-4">
               <div>
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input 
                     type="text" 
                     className="w-full bg-[#1e1e1e] border border-[#3e3e42] p-2 text-sm text-white rounded focus:border-blue-500 outline-none"
                     value={formData.title}
                     onChange={e => setFormData({ ...formData, title: e.target.value })}
                  />
               </div>
               
               <div>
                  <label className="block text-xs text-gray-500 mb-1">Description (Markdown)</label>
                  <textarea 
                     className="w-full bg-[#1e1e1e] border border-[#3e3e42] p-2 text-sm text-white rounded focus:border-blue-500 outline-none h-24 resize-none"
                     value={formData.description}
                     onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
               </div>

               <div className="flex justify-end pt-2">
                  <button 
                     onClick={handleSave}
                     className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
                  >
                     <Save size={14} className="mr-1" />
                     Update
                  </button>
               </div>
            </div>
         )}
      </div>
   );
};

export default ConfigBalloon;
