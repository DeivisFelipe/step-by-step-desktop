import { confirmUnsavedChanges } from './workspace'
import { flushLessonSave } from '../store/useLessonStore'
import { useFileSystemStore } from '../store/useFileSystemStore'

/** Saves what is pending, then closes the app and installs the downloaded version. */
export async function restartToUpdate(): Promise<void> {
  if (!(await confirmUnsavedChanges())) return
  await flushLessonSave()
  // Unsaved edits were handled above; don't let the close prompt ask again.
  const fs = useFileSystemStore.getState()
  for (const path of Object.keys(fs.files)) fs.forgetFile(path)
  window.api.installUpdate()
}
