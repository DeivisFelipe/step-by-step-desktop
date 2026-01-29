import { FilePlus, FolderPlus, RefreshCw, MinusSquare } from 'lucide-react';
import clsx from 'clsx';

interface HeaderProps {
    workspaceName: string;
    onNewFile: () => void;
    onNewFolder: () => void;
    onRefresh: () => void;
    onCollapseAll: () => void;
}

export const FileExplorerHeader = ({ workspaceName, onNewFile, onNewFolder, onRefresh, onCollapseAll }: HeaderProps) => {
  return (
    <div className="px-5 py-2 text-xs font-bold tracking-wider uppercase flex justify-between items-center group">
       <span className="truncate" title={workspaceName || "EXPLORER"}>
          {workspaceName || "EXPLORER"}
       </span>
       <div className="flex items-center space-x-1">
          <button onClick={onNewFile} className="p-1 hover:bg-[#3e3e42] rounded" title="New File">
             <FilePlus size={14} />
          </button>
          <button onClick={onNewFolder} className="p-1 hover:bg-[#3e3e42] rounded" title="New Folder">
             <FolderPlus size={14} />
          </button>
          <button onClick={onRefresh} className="p-1 hover:bg-[#3e3e42] rounded" title="Refresh">
             <RefreshCw size={14} />
          </button>
          <button onClick={onCollapseAll} className="p-1 hover:bg-[#3e3e42] rounded" title="Collapse All">
             <MinusSquare size={14} />
          </button>
       </div>
    </div>
  );
};
