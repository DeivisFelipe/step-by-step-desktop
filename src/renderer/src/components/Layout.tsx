import { useState, useEffect } from 'react';
import ActivityBar from './Sidebar/ActivityBar';
import SidebarContainer from './Sidebar/SidebarContainer';
import MainEditor from './Editor/MainEditor';
import TerminalView from './Terminal/TerminalView';
import AnnotationBalloon from './UI/AnnotationBalloon';
// import ConfigBalloon from './Inspector/ConfigBalloon';

const Layout = () => {
  const [shells, setShells] = useState<string[]>([]);
  const [selectedShell, setSelectedShell] = useState<string>('');

  useEffect(() => {
     window.api.getAvailableShells().then(available => {
        setShells(available);
        if (available.length > 0) setSelectedShell(available[0]);
     });
  }, []);

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-white overflow-hidden relative">
      <ActivityBar />
      <SidebarContainer />
      <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 relative">
             <MainEditor />
             {/* <ConfigBalloon /> */}
             <AnnotationBalloon />
          </div>
          
          {/* Terminal Area */}
          <div className="h-48 border-t border-[#3e3e42] flex flex-col bg-[#1e1e1e]">
             <div className="bg-[#252526] px-2 py-1 text-xs uppercase font-semibold border-b border-[#3e3e42] flex justify-between items-center">
                <span>Terminal</span>
                <select 
                   className="bg-[#3c3c3c] text-white text-xs border border-[#3e3e42] rounded px-2 py-0.5 outline-none"
                   value={selectedShell}
                   onChange={e => setSelectedShell(e.target.value)}
                >
                   {shells.map(s => (
                      <option key={s} value={s}>
                         {s.split('\\').pop()?.split('/').pop()}
                      </option>
                   ))}
                </select>
             </div>
             <div className="flex-1 min-h-0 relative">
                <TerminalView shell={selectedShell} />
             </div>
          </div>
      </div>
    </div>
  );
};

export default Layout;
