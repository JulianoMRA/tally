import { Outlet } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { ToastProvider } from './components/ui'
import styles from './app.module.css'

function App(): React.JSX.Element {
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <Sidebar />
        <div className={styles.content}>
          <div className={styles.scrollable}>
            <Outlet />
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}

export default App
