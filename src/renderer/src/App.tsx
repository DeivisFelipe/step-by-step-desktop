import { IDEProvider } from './context/IDEContext';
import Layout from './components/Layout';
import './assets/main.css';

function App(): React.JSX.Element {
  return (
    <IDEProvider>
      <Layout />
    </IDEProvider>
  )
}

export default App
