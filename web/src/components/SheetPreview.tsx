import type { CircleArt } from '@/lib/circles/crossingSign'
import { UNIT_RADIUS } from '@/lib/circles/crossingSign'
import type { SheetLayout } from '@/lib/circles/printSheet'

interface SheetPreviewProps {
  arts: CircleArt[] // the circles on this page, in print order
  layout: SheetLayout
  diameterPoints: number
  cutLine: boolean
}

// A picture of one printed page (DESIGN.md section 9.4), drawn with the same layout math as the PDF, so what you see is where the circles print.
export default function SheetPreview({ arts, layout, diameterPoints, cutLine }: SheetPreviewProps) {
  const scale = diameterPoints / (2 * UNIT_RADIUS)
  return (
    <svg viewBox={`0 0 ${layout.pageWidth} ${layout.pageHeight}`} className="w-full rounded-sm border bg-white shadow-sm" role="img" aria-label="Page preview">
      {arts.map((art, slot) => {
        const x = layout.first.x + (slot % layout.columns) * layout.pitch
        const y = layout.first.y + Math.floor(slot / layout.columns) * layout.pitch
        return (
          <g key={slot} transform={`translate(${x} ${y}) scale(${scale})`}>
            {art.shapes.map((s, i) => (
              <path key={i} d={s.d} fill={s.fill ?? 'none'} stroke={s.stroke ?? 'none'} strokeWidth={s.strokeWidth} strokeDasharray={s.dash?.join(' ')} />
            ))}
            {cutLine && <circle r={UNIT_RADIUS} fill="none" stroke="#9A9A9A" strokeWidth={0.4 / scale} />}
          </g>
        )
      })}
    </svg>
  )
}
