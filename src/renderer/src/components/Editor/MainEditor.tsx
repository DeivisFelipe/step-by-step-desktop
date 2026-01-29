import { useIDEStore } from '../../store/useIDEStore';
import CodeEditor from './CodeEditor';
import { X } from 'lucide-react';
import clsx from 'clsx';

const MainEditor = () => {
  const { tabs, activeTabId, setActiveTab, closeTab } = useIDEStore();

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
       <div className="flex-none h-9 bg-[#252526] border-b border-[#252526] flex overflow-y-hidden overflow-x-overlay custom-scrollbar">
         {tabs.map(tab => (
            <div 
              key={tab.id}
              className={clsx(
                "flex-shrink-0 flex items-center px-3 text-xs cursor-pointer border-r border-[#1e1e1e] min-w-[120px] max-w-[200px] hover:bg-[#2d2d2d] h-full",
                activeTabId === tab.id ? "bg-[#1e1e1e] text-white" : "text-[#969696] bg-[#2d2d2d]"
              )}
             onClick={() => setActiveTab(tab.id)}
           >
             <span className="truncate flex-1">{tab.title}</span>
             <button 
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="ml-2 p-0.5 rounded hover:bg-[#444]"
             >
               <X size={12} />
             </button>
           </div>
        ))}
      </div>

      {/* Editor Content */}
      <div className="flex-1 bg-[#1e1e1e] overflow-hidden">
         {!activeTab ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
               <div className="text-4xl mb-4 font-thin">Step-by-Step Code</div>
               <p className="text-sm">Open a folder or select a step to begin.</p>
               <p className="text-xs mt-2 text-gray-600">Shortcuts: Ctrl+Shift+P</p>
            </div>
         ) : (
            <div className="h-full w-full">
               <CodeEditor />
            </div>
         )}
      </div>
    </div>
  );
};

export default MainEditor;
