import { extentX, type CircleArt } from '@/lib/circles/crossingSign'

interface NumberCircleProps {
  art: CircleArt
  className?: string // set the size with Tailwind, e.g. "w-24"
  label: string // for screen readers, e.g. "Tile 57"
}

// One sticker on screen (DESIGN.md section 9.4): a number circle (crossingSign) or a tile picture on a hex (tileHex). The shapes are the same ones
// the SVG, PNG, and PDF use.
export default function NumberCircle({ art, className, label }: NumberCircleProps) {
  const e = art.extent
  const ex = extentX(art)
  return (
    <svg viewBox={`${-ex} ${-e} ${2 * ex} ${2 * e}`} className={className} role="img" aria-label={label}>
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
