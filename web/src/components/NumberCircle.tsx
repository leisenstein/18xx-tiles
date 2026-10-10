import type { CircleArt } from '@/lib/circles/crossingSign'

interface NumberCircleProps {
  art: CircleArt
  className?: string // set the size with Tailwind, e.g. "w-24"
  label: string // for screen readers, e.g. "Tile 57"
}

// One tile number circle on screen (DESIGN.md section 9.4). The shapes come from crossingSign(), the same ones the SVG, PNG, and PDF use.
export default function NumberCircle({ art, className, label }: NumberCircleProps) {
  const e = art.extent
  return (
    <svg viewBox={`${-e} ${-e} ${2 * e} ${2 * e}`} className={className} role="img" aria-label={label}>
      {art.shapes.map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill={s.fill ?? 'none'}
          stroke={s.stroke ?? 'none'}
          strokeWidth={s.strokeWidth}
          strokeLinejoin="round"
          strokeDasharray={s.dash?.join(' ')}
        />
      ))}
    </svg>
  )
}
