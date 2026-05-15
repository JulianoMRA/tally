import type { HTMLAttributes } from 'react'
import styles from './card.module.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md'
}

export function Card({ padding = 'md', className, children, ...rest }: CardProps) {
  const cls = [styles.card, styles[`p-${padding}`], className].filter(Boolean).join(' ')
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  )
}
