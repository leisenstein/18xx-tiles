import { useMemo } from 'react'
import { buildTileDrawing, type Point } from '@/lib/tiles/drawing'

interface TileSvgProps {
  definitionCode: string
  color: string
  number?: string // shown small in the lower-right corner
  className?: string // set the size with Tailwind, e.g. "w-32"
}

// Drawing size in SVG units. The SVG scales to whatever width className gives it.
const SIZE = 100

const toPoints = (points: Point[]) =>
  points.map(([x, y]) => `${x},${y}`).join(' ')

// Draws one tile as inline SVG from its definition string (DESIGN.md section 10).
// The geometry lives in buildTileDrawing; this component only turns shapes into SVG elements.
export default function TileSvg({
  definitionCode,
  color,
  number,
  className,
}: TileSvgProps) {
  // Recalculate only when the tile changes, not on every render.
  const drawing = useMemo(
    () => buildTileDrawing(definitionCode, color, SIZE, number),
    [definitionCode, color, number],
  )

  return (
    <svg
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      className={className}
      role="img"
      aria-label={number ? `Tile ${number}, ${color}` : `${color} tile`}
    >
      {drawing.shapes.map((shape, i) => {
        switch (shape.kind) {
          case 'polygon':
            return (
              <polygon
                key={i}
                points={toPoints(shape.points)}
                fill={shape.fill ?? 'none'}
                stroke={shape.stroke ?? 'none'}
                strokeWidth={shape.strokeWidth}
                strokeDasharray={shape.dash?.join(' ')}
              />
            )
          case 'polyline':
            return (
              <polyline
                key={i}
                points={toPoints(shape.points)}
                fill="none"
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth}
                strokeDasharray={shape.dash?.join(' ')}
              />
            )
          case 'circle':
            return (
              <circle
                key={i}
                cx={shape.center[0]}
                cy={shape.center[1]}
                r={shape.r}
                fill={shape.fill}
                stroke={shape.stroke ?? 'none'}
                strokeWidth={shape.strokeWidth}
              />
            )
          case 'text':
            return (
              <text
                key={i}
                x={shape.at[0]}
                y={shape.at[1]}
                fontSize={shape.size}
                fontWeight={shape.bold ? 700 : 400}
                fontFamily="Helvetica, Arial, sans-serif"
                textAnchor="middle"
                fill={shape.fill}
              >
                {shape.text}
              </text>
            )
        }
      })}
    </svg>
  )
}
