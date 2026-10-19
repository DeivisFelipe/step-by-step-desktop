import { useEffect } from 'react'
import Layout from './components/Layout'
import { restoreLastWorkspace } from './lib/workspace'

let restored = false

function App(): React.JSX.Element {
  useEffect(() => {
    // Guard against StrictMode running the effect twice in development.
    if (restored) return
    restored = true
    restoreLastWorkspace()
  }, [])

  return <Layout />
}

export default App
