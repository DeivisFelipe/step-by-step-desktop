import { useEffect } from 'react'
import Layout from './components/Layout'
import { restoreLastWorkspace } from './lib/workspace'
import { initSettings, useSettingsStore } from './store/useSettingsStore'
import { startPublisher, startRemoteControl } from './lib/publisher'

let started = false

function App(): React.JSX.Element {
  const projector = useSettingsStore((s) => s.settings.projector)

  useEffect(() => {
    // Guard against StrictMode running the effect twice in development.
    if (started) return
    started = true
    initSettings()
    startPublisher()
    startRemoteControl()
    window.api.getSettings().then((settings) => {
      if (settings.reopenLastProject) restoreLastWorkspace()
    })
  }, [])

  // Projector mode: everything bigger for the back of the room.
  useEffect(() => {
    window.electron.webFrame.setZoomFactor(projector ? 1.2 : 1)
  }, [projector])

  return <Layout />
}

export default App
