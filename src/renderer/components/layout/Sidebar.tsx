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
        to: '/despesas',
        label: 'Despesas',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        )
      },
      {
        to: '/gastos',
        label: 'Gastos',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 7h16M4 12h16M4 17h10" />
            <circle cx="18" cy="17" r="2" />
          </svg>
        )
      },
      {
        to: '/assinaturas',
        label: 'Assinaturas',
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <polyline points="21 4 21 10 15 10" />
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
        <span className={styles.ver}>v0.1</span>
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
