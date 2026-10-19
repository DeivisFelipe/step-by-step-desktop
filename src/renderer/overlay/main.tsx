import './overlay.css'
import { createRoot } from 'react-dom/client'
import OverlayApp from './OverlayApp'
import { connect } from './connection'

connect()
createRoot(document.getElementById('root')!).render(<OverlayApp />)
