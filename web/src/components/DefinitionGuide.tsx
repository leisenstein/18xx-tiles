import TileSvg from '@/components/TileSvg'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface DefinitionGuideProps {
  onUseExample: (definitionCode: string, color: string) => void // fills the form's definition and color
}

// Worked examples, each drawn with TileSvg. Kept short so each fits on one line in the definition box.
const EXAMPLES: { title: string; color: string; code: string; note: string }[] = [
  { title: 'Straight track', color: 'yellow', code: 'path=a:0,b:3', note: 'Edge 0 (bottom) to edge 3 (top).' },
  { title: 'Gentle curve', color: 'yellow', code: 'path=a:0,b:2', note: 'Edges two apart make a gentle curve.' },
  { title: 'Sharp curve', color: 'yellow', code: 'path=a:0,b:1', note: 'Neighboring edges make a sharp curve.' },
  {
    title: 'Town on a straight',
    color: 'yellow',
    code: 'town=revenue:10;path=a:0,b:_0;path=a:_0,b:3',
    note: 'The town is node _0; one path runs into it and one out.',
  },
  {
    title: 'City with two exits',
    color: 'yellow',
    code: 'city=revenue:20;path=a:0,b:_0;path=a:_0,b:3',
    note: 'Like a town, but a city has station slots.',
  },
  {
    title: 'City with 2 slots, 3 exits',
    color: 'green',
    code: 'city=revenue:30,slots:2;path=a:0,b:_0;path=a:2,b:_0;path=a:4,b:_0',
    note: 'slots sets how many stations fit (1 to 4).',
  },
  {
    title: 'Two cities (OO)',
    color: 'green',
    code: 'city=revenue:40;city=revenue:40;path=a:0,b:_0;path=a:3,b:_1;label=OO',
    note: 'Nodes are numbered in order: the first city is _0, the second _1.',
  },
  {
    title: 'Revenue by phase',
    color: 'brown',
    code: 'city=revenue:yellow_30|green_40|brown_50,slots:2;path=a:0,b:_0;path=a:3,b:_0',
    note: 'One value per phase, joined with |. Drawn as 30/40/50.',
  },
  {
    title: 'Offboard area',
    color: 'red',
    code: 'offboard=revenue:yellow_30|brown_60;path=a:0,b:_0;path=a:1,b:_0',
    note: 'An off-map destination with its own revenue.',
  },
  {
    title: 'Narrow and dual track',
    color: 'green',
    code: 'path=a:0,b:3,track:narrow;path=a:1,b:4,track:dual',
    note: 'track can be broad (the default), narrow, or dual.',
  },
  {
    title: 'Junction',
    color: 'green',
    code: 'junction;path=a:0,b:_0;path=a:2,b:_0;path=a:4,b:_0',
    note: 'Tracks meet at a point that is not a stop.',
  },
  {
    title: 'Label and upgrade cost',
    color: 'yellow',
    code: 'city=revenue:20;path=a:0,b:_0;path=a:_0,b:2;label=B;upgrade=cost:40,terrain:mountain',
    note: 'Text on the tile, and the cost to lay it.',
  },
]

// Parts of the tile language, with their settings.
const PARTS: { part: string; settings: string; meaning: string }[] = [
  { part: 'city', settings: 'revenue, slots (1 to 4), loc', meaning: 'A station stop. A node (_0, _1, ...).' },
  { part: 'town', settings: 'revenue, loc', meaning: 'A small stop, drawn as a dot or a bar. A node.' },
  { part: 'offboard', settings: 'revenue', meaning: 'An off-map destination. A node.' },
  { part: 'junction', settings: '(none)', meaning: 'A point where tracks meet without a stop. A node.' },
  { part: 'path', settings: 'a, b, track, terminal', meaning: 'Track between two ends. Each end is an edge (0 to 5) or a node (_0, _1, ...).' },
  { part: 'label', settings: 'the text itself', meaning: 'Large text, e.g. label=OO or label=B.' },
  { part: 'upgrade', settings: 'cost, terrain', meaning: 'The cost to lay the tile, e.g. upgrade=cost:40.' },
  { part: 'frame', settings: 'color', meaning: 'A colored border, e.g. frame=color:#800080.' },
  { part: 'icon', settings: 'image', meaning: 'A small picture; shown here as its name.' },
]

// The hex with its edge numbers (TILES.md "Anatomy of a Flat Tile"): 0 at the bottom, counting clockwise.
function EdgeDiagram() {
  const cx = 60
  const cy = 52
  const r = 48 // center to corner
  const apothem = r * 0.866 // center to the middle of an edge
  const corners = Array.from({ length: 6 }, (_, i) => `${cx + r * Math.cos((Math.PI / 3) * i)},${cy + r * Math.sin((Math.PI / 3) * i)}`).join(' ')
  // Same angles as drawing.ts (edge e points at -90 - 60e degrees with y up); SVG's y points down, hence the minus sign.
  const label = (edge: number) => {
    const angle = ((-90 - 60 * edge) * Math.PI) / 180
    return { x: cx + 0.72 * apothem * Math.cos(angle), y: cy - 0.72 * apothem * Math.sin(angle) }
  }
  return (
    <svg
      viewBox="0 0 120 104"
      className="w-36 shrink-0"
      role="img"
      aria-label="Hex edge numbers: 0 bottom, 1 lower left, 2 upper left, 3 top, 4 upper right, 5 lower right"
    >
      <polygon points={corners} fill="#FBE88A" stroke="#555555" strokeWidth={1} />
      {[0, 1, 2, 3, 4, 5].map((edge) => {
        const { x, y } = label(edge)
        return (
          <text key={edge} x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="Helvetica, Arial, sans-serif">
            {edge}
          </text>
        )
      })}
    </svg>
  )
}

// "How to write a definition": a collapsible guide under the definition box, with the edge numbers, the parts, and examples you can copy into the form.
export default function DefinitionGuide({ onUseExample }: DefinitionGuideProps) {
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">How to write a definition</summary>
      <div className="mt-3 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <EdgeDiagram />
          <div className="space-y-2">
            <p>
              A definition lists the tile's <strong>parts</strong>, separated by <code className="rounded bg-muted px-1">;</code>. Each part is a type, then{' '}
              <code className="rounded bg-muted px-1">=</code>, then settings separated by <code className="rounded bg-muted px-1">,</code>, each written as{' '}
              <code className="rounded bg-muted px-1">name:value</code>:
            </p>
            <code className="block rounded-md bg-muted p-2 text-xs">city=revenue:20,slots:2;path=a:0,b:_0;path=a:_0,b:3</code>
            <p>
              <strong>Edges</strong> are numbered 0 (bottom) to 5, clockwise, as in the picture. <strong>Nodes</strong> (cities, towns, offboards, junctions)
              are numbered in the order they appear: the first is <code className="rounded bg-muted px-1">_0</code>, the next{' '}
              <code className="rounded bg-muted px-1">_1</code>, and so on. A <code className="rounded bg-muted px-1">path</code> joins two ends, each an edge
              or a node.
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part</TableHead>
              <TableHead>Settings</TableHead>
              <TableHead>What it is</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PARTS.map((p) => (
              <TableRow key={p.part}>
                <TableCell className="font-mono">{p.part}</TableCell>
                <TableCell className="whitespace-normal">{p.settings}</TableCell>
                <TableCell className="whitespace-normal">{p.meaning}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          More: <code className="rounded bg-muted px-1">loc</code> places a node toward an edge (0 to 5), a corner (e.g. 0.5), or the center (loc:center).
          Revenue can change by phase: <code className="rounded bg-muted px-1">revenue:yellow_30|green_40</code>. The full language is described in tobymao/18xx
          TILES.md.
        </p>

        <div className="space-y-2">
          <div className="font-medium">Examples</div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLES.map((example) => (
              <li key={example.title} className="flex gap-3 rounded-lg border p-2">
                <TileSvg definitionCode={example.code} color={example.color} className="w-20 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <div className="font-medium">{example.title}</div>
                  <code className="block text-xs break-all text-muted-foreground">{example.code}</code>
                  <div className="text-xs">{example.note}</div>
                  <Button type="button" variant="outline" size="xs" onClick={() => onUseExample(example.code, example.color)}>
                    Use this example
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  )
}
