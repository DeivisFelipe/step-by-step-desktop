import { useIDEStore } from '../../store/useIDEStore'
import FileExplorer from './FileExplorer'
import LessonSteps from './LessonSteps'
import PresentationPanel from './PresentationPanel'

const SidebarContainer = (): React.JSX.Element => {
  const activeActivity = useIDEStore((s) => s.activeActivity)

  return (
    <div className="h-full w-full bg-ide-panel">
      {activeActivity === 'EXPLORER' ? (
        <FileExplorer />
      ) : activeActivity === 'STEPS' ? (
        <LessonSteps />
      ) : (
        <PresentationPanel />
      )}
    </div>
  )
}

export default SidebarContainer
