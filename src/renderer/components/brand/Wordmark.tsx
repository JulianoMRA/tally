import styles from './wordmark.module.css'

interface WordmarkProps {
  size?: number
  color?: string
}

export function Wordmark({ size = 20 }: WordmarkProps) {
  return (
    <span className={styles.wordmark} style={{ fontSize: size }}>
      Tally
    </span>
  )
}
