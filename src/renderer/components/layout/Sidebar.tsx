import { NavLink, useLocation } from 'react-router-dom'
import { Mark } from '../brand/Mark'
import { Wordmark } from '../brand/Wordmark'
import styles from './sidebar.module.css'

interface NavGroup {
  label: string
  items: { to: string; label: string; icon: React.ReactNode }[]
}

const NAV: NavGroup[] = [
  {
    label: 'Finanças',
    items: [
      {
        to: '/mensal',
        label: 'Visão mensal',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        )
      },
      {
        to: '/faturas',
        label: 'Faturas',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        )
      },
      {
        to: '/saidas',
        label: 'Saídas',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 7h11M4 12h11M4 17h7" />
            <path d="M17 9l4 3-4 3" />
          </svg>
        )
      },
      {
        to: '/rendas',
        label: 'Rendas',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        )
      },
      {
        to: '/simulacao',
        label: 'Simulação',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="8" y1="6" x2="16" y2="6" />
            <line x1="8" y1="11" x2="8" y2="11" />
            <line x1="12" y1="11" x2="12" y2="11" />
            <line x1="16" y1="11" x2="16" y2="11" />
            <line x1="8" y1="15" x2="8" y2="15" />
            <line x1="12" y1="15" x2="12" y2="15" />
            <line x1="16" y1="15" x2="16" y2="18" />
            <line x1="8" y1="18" x2="12" y2="18" />
          </svg>
        )
      }
    ]
  },
  {
    label: 'Configuração',
    items: [
      {
        to: '/cartoes',
        label: 'Cartões',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        )
      },
      {
        to: '/categorias',
        label: 'Categorias',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )
      },
      {
        to: '/importar',
        label: 'Importar dados',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )
      },
      {
        to: '/ajustes',
        label: 'Ajustes',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        )
      }
    ]
  }
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Mark variant="primary" size={22} />
        <Wordmark size={20} />
        <span className={styles.ver}>v{__APP_VERSION__}</span>
      </div>

      {NAV.map((group) => (
        <div key={group.label} className={styles.group}>
          <span className={styles.groupLabel}>{group.label}</span>
          {group.items.map((item) => {
            const isActive =
              location.pathname === item.to || location.pathname.startsWith(item.to + '/')
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={[styles.navItem, isActive ? styles.active : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className={styles.icon}>{item.icon}</span>
                {item.label}
              </NavLink>
            )
          })}
        </div>
      ))}

      <div className={styles.spacer} />

      <div className={styles.foot}>
        <div className={styles.avatar}>J</div>
        <div className={styles.me}>
          <span className={styles.name}>Juliano</span>
          <span className={styles.role}>pessoal</span>
        </div>
      </div>
    </aside>
  )
}
