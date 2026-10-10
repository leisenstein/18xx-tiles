// Turns a tile definition into a list of shapes to draw (DESIGN.md section 10).
// Ported from render_tile in reference/build_pdf.py.
//
// The math works in "y up" coordinates like the prototype (angle 0 = right,
// angles grow counterclockwise). SVG's y axis points down, so every point is
// flipped (y -> height - y) when the shape is added.
import { tileFills } from './colors'
import { parseDefinition, revenueText } from './parse'

export type Point = [number, number]

export type Shape =
  | {
      kind: 'polygon'
      points: Point[]
      fill?: string
      stroke?: string
      strokeWidth?: number
      dash?: number[]
    }
  | {
      kind: 'polyline'
      points: Point[]
      stroke: string
      strokeWidth: number
      dash?: number[]
    }
  | {
      kind: 'circle'
      center: Point
      r: number
      fill: string
      stroke?: string
      strokeWidth?: number
    }
  | {
      kind: 'text'
      at: Point
      text: string
      size: number
      bold: boolean
      fill: string
    }

export interface TileDrawing {
  width: number
  height: number
  shapes: Shape[]
}

// A city, town, junction, offboard, or pass, referred to by paths as "_0", "_1", ...
interface TileNode {
  kind: string
  slots: number
  revenue: string | null
  loc: string | undefined
  edges: number[] // edges this node connects to
  neighbors: number[] // other nodes this node connects to
  pos: Point | null
  // Set for a town on a single edge-to-edge curve: the curve, and its direction at the town.
  through: { curve: [Point, Point, Point, Point]; angle: number } | null
}

const rad = (deg: number) => (deg * Math.PI) / 180

// Edge numbering per TILES.md: 0 bottom, 1 lower-left, 2 upper-left, 3 top, 4 upper-right, 5 lower-right.
const edgeAngle = (edge: number) => rad(-90 - 60 * edge)

// Point on a cubic Bezier curve at t (0..1).
function bezier(
  [p0, p1, p2, p3]: [Point, Point, Point, Point],
  t: number,
): Point {
  const u = 1 - t
  return [
    u ** 3 * p0[0] +
      3 * u * u * t * p1[0] +
      3 * u * t * t * p2[0] +
      t ** 3 * p3[0],
    u ** 3 * p0[1] +
      3 * u * u * t * p1[1] +
      3 * u * t * t * p2[1] +
      t ** 3 * p3[1],
  ]
}

const isNodeRef = (ref: string) => ref.startsWith('_')

// Rough text width; SVG cannot measure text before it is drawn.
const textWidth = (text: string, size: number, bold: boolean) =>
  text.length * size * (bold ? 0.6 : 0.55)

export function buildTileDrawing(
  code: string,
  color: string,
  size: number,
  number?: string,
): TileDrawing {
  const R = size / 2 - 1 // corner radius
  const a = (R * Math.sqrt(3)) / 2 // center to edge midpoint
  const width = size
  const height = 2 * a + 2
  const cx = width / 2
  const cy = height / 2
  const shapes: Shape[] = []

  // Convert from y-up math to SVG coordinates.
  const flip = ([x, y]: Point): Point => [x, height - y]
  const add = (shape: Shape) => {
    if (shape.kind === 'circle')
      shapes.push({ ...shape, center: flip(shape.center) })
    else if (shape.kind === 'text')
      shapes.push({ ...shape, at: flip(shape.at) })
    else shapes.push({ ...shape, points: shape.points.map(flip) })
  }

  // Hex corners (flat top: corners at 0, 60, ... degrees).
  const corners: Point[] = Array.from({ length: 6 }, (_, i) => [
    cx + R * Math.cos(rad(60 * i)),
    cy + R * Math.sin(rad(60 * i)),
  ])

  // Background: one fill, or two halves (left first color, right second).
  const fills = tileFills(color)
  if (fills.length === 1) {
    add({ kind: 'polygon', points: corners, fill: fills[0] })
  } else {
    add({
      kind: 'polygon',
      fill: fills[0],
      points: [
        [cx, cy + a],
        [cx - R / 2, cy + a],
        [cx - R, cy],
        [cx - R / 2, cy - a],
        [cx, cy - a],
      ],
    })
    add({
      kind: 'polygon',
      fill: fills[1],
      points: [
        [cx, cy + a],
        [cx + R / 2, cy + a],
        [cx + R, cy],
        [cx + R / 2, cy - a],
        [cx, cy - a],
      ],
    })
  }

  // Sort the definition's parts into nodes, paths, labels, and other text.
  const nodes: TileNode[] = []
  const paths: Record<string, string>[] = []
  const labels: string[] = []
  const extras: string[] = []
  let frame: string | undefined
  for (const { type, values } of parseDefinition(code)) {
    if (['city', 'town', 'junction', 'offboard', 'pass'].includes(type)) {
      const slots = Number.parseInt(values.slots ?? '1', 10)
      nodes.push({
        kind: type,
        slots: Number.isNaN(slots) ? 1 : slots,
        revenue: revenueText(values.revenue),
        loc: values.loc,
        edges: [],
        neighbors: [],
        pos: null,
        through: null,
      })
    } else if (type === 'path') {
      paths.push(values)
    } else if (type === 'label') {
      const label = Object.keys(values)[0]
      if (label) labels.push(label)
    } else if (type === 'frame') {
      frame = values.color
    } else if (type === 'upgrade') {
      extras.push('$' + (values.cost ?? '?'))
    } else if (type === 'icon') {
      extras.push('icon:' + (values.image ?? '?').split('/').pop())
    } else if (type === 'future_label') {
      extras.push(
        'future ' +
          (values.label ?? '?') +
          (values.color ? ` (${values.color})` : ''),
      )
    }
    // Other part types are ignored (DESIGN.md: unknown parts must not break the tile).
  }

  const nodeAt = (ref: string): TileNode | undefined =>
    nodes[Number.parseInt(ref.slice(1), 10)]
  const edgeOf = (ref: string) => Math.trunc(Number.parseFloat(ref))
  const edgeMidpoint = (edge: number): Point => [
    cx + a * Math.cos(edgeAngle(edge)),
    cy + a * Math.sin(edgeAngle(edge)),
  ]
  // Move a point toward the center by k.
  const inward = ([x, y]: Point, k: number): Point => [
    x + ((cx - x) / a) * k,
    y + ((cy - y) / a) * k,
  ]

  // Record what each node connects to.
  for (const path of paths) {
    const ends = [path.a ?? '', path.b ?? '']
    for (const [from, to] of [ends, [...ends].reverse()]) {
      if (!isNodeRef(from)) continue
      const node = nodeAt(from)
      if (!node) continue
      if (isNodeRef(to)) node.neighbors.push(Number.parseInt(to.slice(1), 10))
      else if (to !== '') node.edges.push(edgeOf(to))
    }
  }

  // Place nodes (the definition language leaves this to the renderer).
  const realNodes = nodes.filter((n) => n.kind !== 'junction')
  for (const node of nodes) {
    const loc = node.loc
    if (node.kind === 'junction' || loc === 'center') {
      node.pos = [cx, cy]
    } else if (loc !== undefined && loc !== '') {
      // Integer loc: toward that edge. "x.5": toward that corner.
      const f = Number.parseFloat(loc)
      const [angle, r] = Number.isInteger(f)
        ? [edgeAngle(f), 0.55 * a]
        : [rad(-90 - 60 * f), 0.55 * R]
      node.pos = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
    } else if (
      node.kind === 'town' &&
      node.edges.length === 2 &&
      node.neighbors.length === 0
    ) {
      // A town on a curve between two edges sits in the middle of the curve.
      const p0 = edgeMidpoint(node.edges[0])
      const p3 = edgeMidpoint(node.edges[1])
      const curve: [Point, Point, Point, Point] = [
        p0,
        inward(p0, 0.5 * a),
        inward(p3, 0.5 * a),
        p3,
      ]
      node.pos = bezier(curve, 0.5)
      const q1 = bezier(curve, 0.45)
      const q2 = bezier(curve, 0.55)
      node.through = { curve, angle: Math.atan2(q2[1] - q1[1], q2[0] - q1[0]) }
    } else if (realNodes.length === 1) {
      node.pos = [cx, cy]
    } else if (node.edges.length > 0) {
      // Toward the average direction of its edges.
      const vx = node.edges.reduce((s, e) => s + Math.cos(edgeAngle(e)), 0)
      const vy = node.edges.reduce((s, e) => s + Math.sin(edgeAngle(e)), 0)
      const length = Math.hypot(vx, vy)
      node.pos =
        length < 1e-6
          ? [cx, cy]
          : [cx + (vx / length) * 0.5 * a, cy + (vy / length) * 0.5 * a]
    }
  }

  // Nodes with no edges and no loc: spread opposite the placed ones.
  const unplaced = nodes.filter((n) => n.pos === null)
  if (unplaced.length > 0) {
    const placed = nodes
      .map((n) => n.pos)
      .filter((p): p is Point => p !== null && (p[0] !== cx || p[1] !== cy))
    let base = rad(90)
    if (placed.length > 0) {
      const mx = placed.reduce((s, p) => s + p[0] - cx, 0)
      const my = placed.reduce((s, p) => s + p[1] - cy, 0)
      if (Math.hypot(mx, my) > 1e-6) base = Math.atan2(-my, -mx)
    }
    unplaced.forEach((node, i) => {
      const angle = base + (i - (unplaced.length - 1) / 2) * rad(60)
      node.pos = [
        cx + 0.5 * a * Math.cos(angle),
        cy + 0.5 * a * Math.sin(angle),
      ]
    })
  }

  // Nudge nodes that landed on exactly the same spot.
  const seen = new Set<string>()
  for (const node of nodes) {
    const [x, y] = node.pos!
    const key = `${x.toFixed(1)},${y.toFixed(1)}`
    if (seen.has(key) && node.kind !== 'junction') node.pos = [x, y - 0.45 * a]
    seen.add(key)
  }
  const posOf = (node: TileNode) => node.pos as Point

  // Track. Styles: broad = solid; narrow/thin = thinner dashed; dual = black with white dashed center.
  const occupied: Point[] = []
  const lw = 0.13 * a
  const drawTrack = (points: Point[], track: string) => {
    if (track === 'narrow' || track === 'thin') {
      add({
        kind: 'polyline',
        points,
        stroke: 'black',
        strokeWidth: lw * 0.55,
        dash: [lw * 0.9, lw * 0.6],
      })
    } else {
      add({ kind: 'polyline', points, stroke: 'black', strokeWidth: lw })
      if (track === 'dual') {
        add({
          kind: 'polyline',
          points,
          stroke: 'white',
          strokeWidth: lw * 0.3,
          dash: [lw * 0.6, lw * 0.6],
        })
      }
    }
    occupied.push(...points)
  }
  const curvePoints = (
    curve: [Point, Point, Point, Point],
    segments = 24,
  ): Point[] =>
    Array.from({ length: segments + 1 }, (_, i) => bezier(curve, i / segments))

  const drawnThrough = new Set<TileNode>()
  for (const path of paths) {
    const A = path.a ?? ''
    const B = path.b ?? ''
    const track = path.track ?? 'broad'
    if (!isNodeRef(A) && !isNodeRef(B)) {
      // Edge to edge: a curve pulled toward the center.
      const p0 = edgeMidpoint(edgeOf(A))
      const p3 = edgeMidpoint(edgeOf(B))
      drawTrack(
        curvePoints([p0, inward(p0, 0.5 * a), inward(p3, 0.5 * a), p3]),
        track,
      )
    } else if (isNodeRef(A) && isNodeRef(B)) {
      // Node to node: straight.
      const n1 = nodeAt(A)
      const n2 = nodeAt(B)
      if (n1 && n2) drawTrack([posOf(n1), posOf(n2)], track)
    } else {
      // Edge to node: curve into the node (or the town's through-curve, drawn once).
      const node = nodeAt(isNodeRef(A) ? A : B)
      if (!node) continue
      if (node.through) {
        if (!drawnThrough.has(node)) {
          drawnThrough.add(node)
          drawTrack(curvePoints(node.through.curve), track)
        }
        continue
      }
      const p0 = edgeMidpoint(edgeOf(isNodeRef(A) ? B : A))
      const q = posOf(node)
      const distance = Math.hypot(q[0] - p0[0], q[1] - p0[1])
      drawTrack(
        curvePoints([p0, inward(p0, Math.min(0.45 * a, distance * 0.5)), q, q]),
        track,
      )
    }
  }

  // Optional colored frame just inside the edge.
  if (frame) {
    const inset = R - 0.07 * a
    const framePoints: Point[] = Array.from({ length: 6 }, (_, i) => [
      cx + inset * Math.cos(rad(60 * i)),
      cy + inset * Math.sin(rad(60 * i)),
    ])
    add({
      kind: 'polygon',
      points: framePoints,
      stroke: frame,
      strokeWidth: 0.12 * a,
    })
  }

  // Nodes. "badges" are nodes that may show a revenue circle, with their size.
  const cr = 0.19 * a // city slot radius
  const badges: { node: TileNode; extent: number }[] = []
  for (const node of nodes) {
    const [x, y] = posOf(node)
    if (node.kind === 'city') {
      const s = Math.min(Math.max(node.slots, 1), 4) // slots:0 draws as one slot
      const offsets: Point[] =
        s === 1
          ? [[0, 0]]
          : s === 2
            ? [
                [-cr, 0],
                [cr, 0],
              ]
            : s === 3
              ? [
                  [-cr, -cr * 0.58],
                  [cr, -cr * 0.58],
                  [0, cr * 1.15],
                ]
              : [
                  [-cr, -cr],
                  [cr, -cr],
                  [-cr, cr],
                  [cr, cr],
                ]
      if (s === 2) {
        add({
          kind: 'polygon',
          fill: 'white',
          points: [
            [x - cr, y - cr],
            [x + cr, y - cr],
            [x + cr, y + cr],
            [x - cr, y + cr],
          ],
        })
      }
      if (s >= 3) {
        add({
          kind: 'circle',
          center: [x, y],
          r: cr * (s === 3 ? 1.85 : 2.2),
          fill: 'white',
          stroke: 'black',
          strokeWidth: 0.6,
        })
      }
      for (const [ox, oy] of offsets) {
        add({
          kind: 'circle',
          center: [x + ox, y + oy],
          r: cr,
          fill: 'white',
          stroke: 'black',
          strokeWidth: 0.8,
        })
      }
      const extent = cr * (s === 1 ? 1 : 2.2)
      for (let deg = 0; deg < 360; deg += 30) {
        occupied.push([
          x + extent * Math.cos(rad(deg)),
          y + extent * Math.sin(rad(deg)),
        ])
      }
      occupied.push([x, y])
      badges.push({ node, extent })
    } else if (node.kind === 'town') {
      let extent: number
      if (node.through) {
        // A bar across the track.
        const angle = node.through.angle + Math.PI / 2
        const hl = 0.2 * a
        const hw = 0.065 * a
        const dx = Math.cos(angle)
        const dy = Math.sin(angle)
        const px = -dy
        const py = dx
        add({
          kind: 'polygon',
          fill: 'black',
          points: [
            [x + dx * hl + px * hw, y + dy * hl + py * hw],
            [x + dx * hl - px * hw, y + dy * hl - py * hw],
            [x - dx * hl - px * hw, y - dy * hl - py * hw],
            [x - dx * hl + px * hw, y - dy * hl + py * hw],
          ],
        })
        extent = 0.2 * a
      } else {
        add({ kind: 'circle', center: [x, y], r: 0.1 * a, fill: 'black' })
        extent = 0.1 * a
      }
      occupied.push([x, y])
      badges.push({ node, extent })
    } else if (node.kind === 'pass') {
      add({
        kind: 'circle',
        center: [x, y],
        r: 0.09 * a,
        fill: 'white',
        stroke: 'black',
        strokeWidth: 0.8,
      })
      badges.push({ node, extent: 0.09 * a })
    } else if (node.kind === 'junction') {
      add({ kind: 'circle', center: [x, y], r: lw * 0.5, fill: 'black' })
    } else if (node.kind === 'offboard') {
      // Not drawn by the prototype; shown here as a small black triangle so its revenue has an anchor.
      add({
        kind: 'polygon',
        fill: 'black',
        points: [
          [x, y + 0.12 * a],
          [x - 0.1 * a, y - 0.06 * a],
          [x + 0.1 * a, y - 0.06 * a],
        ],
      })
      occupied.push([x, y])
      badges.push({ node, extent: 0.12 * a })
    }
  }

  // Is a point inside the hex, keeping a margin of m * a from the edges?
  const inside = (px: number, py: number, m = 0.12) => {
    for (let i = 0; i < 6; i++) {
      const angle = edgeAngle(i)
      if (
        (px - cx) * Math.cos(angle) + (py - cy) * Math.sin(angle) >
        a * (1 - m)
      )
        return false
    }
    return true
  }
  // Distance from a point to the nearest drawn thing.
  const clearance = (px: number, py: number) =>
    occupied.length === 0
      ? 99
      : Math.min(...occupied.map(([qx, qy]) => Math.hypot(px - qx, py - qy)))

  // Revenue circles: try spots around each node; keep the one with the most clearance.
  const br = 0.15 * a
  for (const { node, extent } of badges) {
    if (!node.revenue || node.revenue === '0') continue
    const [x, y] = posOf(node)
    let best: Point | null = null
    let bestClearance = -1
    for (let deg = 0; deg < 360; deg += 15) {
      for (const distance of [extent + br * 1.15, extent + br * 1.6]) {
        const px = x + distance * Math.cos(rad(deg))
        const py = y + distance * Math.sin(rad(deg))
        if (!inside(px, py, 0.08 + (1.3 * br) / a)) continue
        const c = clearance(px, py)
        if (c > bestClearance) {
          bestClearance = c
          best = [px, py]
        }
      }
    }
    if (!best) continue
    const text = node.revenue
    const rr = br * (text.length <= 2 ? 1 : text.length <= 3 ? 1.25 : 1.6)
    const fs = rr * (text.length <= 2 ? 1.05 : text.length <= 3 ? 0.85 : 0.6)
    add({
      kind: 'circle',
      center: best,
      r: rr,
      fill: 'white',
      stroke: 'black',
      strokeWidth: 0.5,
    })
    add({
      kind: 'text',
      at: [best[0], best[1] - fs * 0.35],
      text,
      size: fs,
      bold: false,
      fill: 'black',
    })
    for (let deg = 0; deg < 360; deg += 45) {
      occupied.push([
        best[0] + rr * Math.cos(rad(deg)),
        best[1] + rr * Math.sin(rad(deg)),
      ])
    }
  }

  // Labels and other text: the candidate spot with the most clearance that fits inside the hex.
  const placeText = (text: string, fs: number, bold: boolean) => {
    const candidates: Point[] = []
    for (let i = 0; i < 6; i++) {
      for (const frac of [0.62, 0.72]) {
        candidates.push([
          cx + frac * R * Math.cos(rad(-60 * i)),
          cy + frac * R * Math.sin(rad(-60 * i)),
        ])
      }
      candidates.push([
        cx + 0.62 * a * Math.cos(edgeAngle(i)),
        cy + 0.62 * a * Math.sin(edgeAngle(i)),
      ])
    }
    for (const frac of [0.55, 0.45, 0.35]) {
      for (let i = 0; i < 6; i++) {
        candidates.push([
          cx + frac * R * Math.cos(rad(-60 * i)),
          cy + frac * R * Math.sin(rad(-60 * i)),
        ])
      }
    }
    const tw = textWidth(text, fs, bold)
    const fits = ([px, py]: Point) =>
      [-1, 1].every((sx) =>
        [-1, 1].every((sy) =>
          inside(px + (sx * tw) / 2, py + sy * fs * 0.45, 0.04),
        ),
      )
    const options = candidates.filter(fits)
    let best: Point = [cx, cy]
    let bestClearance = -1
    for (const [px, py] of options.length > 0 ? options : [best]) {
      const c = clearance(px, py)
      if (c > bestClearance) {
        bestClearance = c
        best = [px, py]
      }
    }
    add({
      kind: 'text',
      at: [best[0], best[1] - fs * 0.35],
      text,
      size: fs,
      bold,
      fill: 'black',
    })
    for (const dx of [-1, 0, 1])
      occupied.push([best[0] + dx * fs * text.length * 0.3, best[1]])
  }
  // The tile number goes in the lower-right corner. Reserve its spot before
  // placing labels, so a label never lands on top of it.
  const numberSize = 0.17 * a
  const numberAt: Point = [
    cx + 0.78 * R * Math.cos(rad(-60)) - 0.05 * a,
    cy + 0.78 * R * Math.sin(rad(-60)) + 0.03 * a,
  ]
  if (number) {
    for (const dx of [-1, 0, 1]) {
      occupied.push([
        numberAt[0] + dx * numberSize * number.length * 0.3,
        numberAt[1],
      ])
    }
  }

  for (const label of labels) {
    placeText(
      label,
      label.length <= 2 ? 0.36 * a : label.length <= 3 ? 0.26 * a : 0.18 * a,
      true,
    )
  }
  for (const extra of extras) placeText(extra, 0.15 * a, false)

  // Outline: dashed for "none", gray otherwise.
  const outline = corners
  if (color === 'none')
    add({
      kind: 'polygon',
      points: outline,
      stroke: 'black',
      strokeWidth: 0.6,
      dash: [2, 2],
    })
  else
    add({
      kind: 'polygon',
      points: outline,
      stroke: '#555555',
      strokeWidth: 0.6,
    })

  // Tile number, in the spot reserved above.
  if (number) {
    add({
      kind: 'text',
      at: [numberAt[0], numberAt[1] - numberSize * 0.3],
      text: number,
      size: numberSize,
      bold: false,
      fill: '#333333',
    })
  }

  return { width, height, shapes }
}
