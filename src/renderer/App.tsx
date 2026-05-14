import { NavLink, Outlet } from 'react-router-dom'
import styles from './app.module.css'

function App(): React.JSX.Element {
  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>Tally</div>
        <NavLink
          to="/cartoes"
          className={({ isActive }) =>
            isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
          }
        >
          Cartões
        </NavLink>
        <NavLink
          to="/categorias"
          className={({ isActive }) =>
            isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
          }
        >
          Categorias
        </NavLink>
      </nav>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}

export default App
