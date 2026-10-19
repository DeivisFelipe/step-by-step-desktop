import { useIDEStore } from '../../store/useIDEStore'
import FileExplorer from './FileExplorer'
import LessonSteps from './LessonSteps'

const SidebarContainer = (): React.JSX.Element => {
  const activeActivity = useIDEStore((s) => s.activeActivity)

  return (
    <div className="h-full w-full bg-ide-panel">
      {activeActivity === 'EXPLORER' ? <FileExplorer /> : <LessonSteps />}
    </div>
  )
}

export default SidebarContainer
