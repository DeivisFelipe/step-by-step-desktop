import { useIDEStore } from '../../store/useIDEStore';
import FileExplorer from './FileExplorer';
import LessonSteps from './LessonSteps';

const SidebarContainer = () => {
  const { activeActivity } = useIDEStore();

  return (
    <div className="h-full w-60 border-r border-[#1e1e1e]">
       {activeActivity === 'EXPLORER' && <FileExplorer />}
       {activeActivity === 'STEPS' && <LessonSteps />}
    </div>
  );
};

export default SidebarContainer;
