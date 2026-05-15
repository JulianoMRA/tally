type MarkVariant = 'primary' | 'tally' | 'stack' | 'monogram'

interface MarkProps {
  variant?: MarkVariant
  fill?: string
  bg?: string
  radius?: number
  size?: number
  className?: string
}

export function Mark({
  variant = 'primary',
  fill = 'currentColor',
  bg = 'none',
  radius = 14,
  size = 24,
  className
}: MarkProps) {
  const bgRect = bg !== 'none' ? <rect width="64" height="64" rx={radius} fill={bg} /> : null

  if (variant === 'tally') {
    return (
      <svg
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        width={size}
        height={size}
        className={className}
      >
        {bgRect}
        <g stroke={fill} strokeWidth="4" strokeLinecap="square" fill="none">
          <line x1="16" y1="16" x2="16" y2="48" />
          <line x1="24" y1="16" x2="24" y2="48" />
          <line x1="32" y1="16" x2="32" y2="48" />
          <line x1="40" y1="16" x2="40" y2="48" />
          <line x1="12" y1="44" x2="46" y2="20" />
        </g>
      </svg>
    )
  }

  if (variant === 'stack') {
    return (
      <svg
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        width={size}
        height={size}
        className={className}
      >
        {bgRect}
        <g fill={fill}>
          <rect x="12" y="44" width="10" height="8" rx="1" />
          <rect x="12" y="34" width="10" height="8" rx="1" opacity="0.78" />
          <rect x="27" y="34" width="10" height="18" rx="1" />
          <rect x="27" y="24" width="10" height="8" rx="1" opacity="0.78" />
          <rect x="27" y="14" width="10" height="8" rx="1" opacity="0.56" />
          <rect x="42" y="24" width="10" height="28" rx="1" />
          <rect x="42" y="14" width="10" height="8" rx="1" opacity="0.78" />
        </g>
      </svg>
    )
  }

  if (variant === 'monogram') {
    return (
      <svg
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        width={size}
        height={size}
        className={className}
      >
        {bgRect}
        <g fill={fill}>
          <rect x="14" y="18" width="36" height="6" rx="1" />
          <rect x="29" y="24" width="6" height="26" rx="1" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
    >
      {bgRect}
      <g fill={fill}>
        <rect x="12" y="14" width="40" height="6" rx="1" />
        <rect x="28" y="24" width="8" height="4" rx="1" />
        <rect x="28" y="30" width="8" height="4" rx="1" />
        <rect x="28" y="36" width="8" height="4" rx="1" />
        <rect x="28" y="42" width="8" height="4" rx="1" />
        <rect x="28" y="48" width="8" height="4" rx="1" />
      </g>
    </svg>
  )
}
