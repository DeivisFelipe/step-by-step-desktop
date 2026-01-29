import ActivityBar from './Sidebar/ActivityBar';
import SidebarContainer from './Sidebar/SidebarContainer';
import MainEditor from './Editor/MainEditor'; 
import TerminalView from './Terminal/TerminalView';
import AnnotationBalloon from './UI/AnnotationBalloon';
import ConfigBalloon from './Inspector/ConfigBalloon';

const Layout = () => {
  return (
    <div className="flex h-screen w-screen bg-[#1e1e1e] text-gray-300 overflow-hidden relative">
      <AnnotationBalloon />
{/* <ConfigBalloon /> */}
      
      {/* Activity Bar */}
      <ActivityBar />

      {/* Sidebar */}
      <SidebarContainer />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
         {/* Main Editor Area (Tabs + Editor) */}
         <div className="flex-1 min-h-0 flex flex-col">
            <MainEditor />
         </div>

         {/* Terminal Area */}
         <div className="h-48 border-t border-[#3e3e42] flex flex-col bg-[#1e1e1e]">
            <div className="bg-[#252526] px-2 py-1 text-xs uppercase font-semibold border-b border-[#3e3e42]">
               Terminal
            </div>
            <div className="flex-1 min-h-0 relative">
               <TerminalView />
            </div>
         </div>
      </div>
    </div>
  );
};

export default Layout;
