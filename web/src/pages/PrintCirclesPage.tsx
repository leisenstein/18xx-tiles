import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Printer } from 'lucide-react'
import { getGame } from '@/api/games'
import { getTile, getTiles } from '@/api/tiles'
import LoadingState from '@/components/LoadingState'
import NumberCircle from '@/components/NumberCircle'
import PageHeader from '@/components/PageHeader'
import SheetPreview from '@/components/SheetPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { apiErrorMessages } from '@/lib/apiErrors'
import { circlePng, circleSvg } from '@/lib/circles/circleFiles'
import { crossingSign, extentX, MIN_NUMBER_POINTS, type CircleArt } from '@/lib/circles/crossingSign'
import { loadNumberFont, type NumberFont } from '@/lib/circles/numberFont'
import { buildSheetPdf, PAPER_SIZES, sheetLayout, type Paper, type SheetOptions, type StickerShape } from '@/lib/circles/printSheet'
import { tileHex } from '@/lib/circles/tileHex'
import { downloadBlob, fileSafe } from '@/lib/download'
import { countText } from '@/lib/tileCount'
import { TILE_COLORS, tileFills } from '@/lib/tiles/colors'

// One tile on the print list. count is the game's box count (null = unknown, 999 = unlimited), shown for reference; the quantity always starts at 1,
// because a sticker marks the tile's slot in a storage tray, not each tile in the box.
interface CircleRow {
  tileId: number
  number: string
  color: string
  definitionCode: string // drawn on the tile-picture (hex) stickers
  displayName: string
  count: number | null
}

const SIZES = [
  { inches: 0.5, label: '1/2 inch' },
  { inches: 0.75, label: '3/4 inch' },
  { inches: 1, label: '1 inch' },
]
// Sticker styles. The tile picture comes in 3/4 and 1 inch (across the hex's flat sides); at 1/2 inch track and revenues get too crowded.
const STYLES: { shape: StickerShape; label: string }[] = [
  { shape: 'circle', label: 'Number circle' },
  { shape: 'hex', label: 'Tile picture (hex)' },
]
const HEX_SIZES = [0.75, 1]
const BLEEDS = [
  { inches: 0, label: 'None' },
  { inches: 1 / 16, label: '1/16 inch' },
  { inches: 1 / 8, label: '1/8 inch' },
]
const MAX_QUANTITY = 200

const positiveInt = (value: string | null) => {
  const n = Number(value)
  return value !== null && Number.isInteger(n) && n > 0 ? n : undefined
}
const DEFAULT_QUANTITY = 1
// Color names for the quick-select buttons: "greenbrown" -> "Green/brown".
const COLOR_NAMES: Record<string, string> = { greenbrown: 'Green/brown', browngray: 'Brown/gray', brownsepia: 'Brown/sepia' }
const colorName = (color: string) => COLOR_NAMES[color] ?? color.charAt(0).toUpperCase() + color.slice(1)

// Print tile stickers for tile trays (/print/circles?tile=ID or ?game=ID, DESIGN.md section 9.4): a crossing-sign circle with the tile number, or a
// picture of the tile itself on a 3/4 or 1 inch hex. A PDF sheet for one tile or a whole game's tile set, or one sticker as SVG or PNG. Everything is drawn
// in the browser; nothing is sent to the server.
// Signed-in users only: App.tsx wraps this page in RequireRole (no role needed), and the links to it are shown only when signed in.
export default function PrintCirclesPage() {
  const [params] = useSearchParams()
  const tileId = positiveInt(params.get('tile'))
  const gameId = positiveInt(params.get('game'))
  const sourceKey = gameId ? `game:${gameId}` : tileId ? `tile:${tileId}` : null

  const [font, setFont] = useState<NumberFont | null>(null)
  const [source, setSource] = useState<{ key: string; title: string; rows: CircleRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<number, string>>({}) // what the user typed, by tile id
  // Tiles left off the sheet (unchecked), by tile id. Everything starts checked; unchecking keeps the tile's quantity for when it is checked again.
  const [unchecked, setUnchecked] = useState<Record<number, boolean>>({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [options, setOptions] = useState<SheetOptions>({
    paper: 'letter',
    shape: 'circle',
    diameterInches: 0.75,
    marginInches: 0.5,
    spacingInches: 0.125,
    bleedInches: 0,
    cutLine: true,
  })
  const [previewPage, setPreviewPage] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadNumberFont()
      .then(setFont)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  // Load the tile, or every tile of the game with its box count.
  useEffect(() => {
    if (!sourceKey) return
    let ignore = false
    const load = async (): Promise<{ title: string; rows: CircleRow[] }> => {
      if (gameId) {
        const game = await getGame(gameId)
        const rows: CircleRow[] = []
        for (let page = 1, pages = 1; page <= pages; page++) {
          const result = await getTiles({ game: gameId, page, pageSize: 200 })
          pages = result.totalPages
          rows.push(
            ...result.items.map((t) => ({
              tileId: t.id,
              number: t.number,
              color: t.color,
              definitionCode: t.definitionCode,
              displayName: t.displayName,
              count: t.countInGame,
            })),
          )
        }
        return { title: game.title, rows }
      }
      const tile = await getTile(tileId!)
      return {
        title: tile.displayName,
        rows: [{ tileId: tile.id, number: tile.number, color: tile.color, definitionCode: tile.definitionCode, displayName: tile.displayName, count: null }],
      }
    }
    load()
      .then((loaded) => {
        if (ignore) return
        setSource({ key: sourceKey, ...loaded })
        setError(null)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [sourceKey, gameId, tileId])

  const rows = useMemo(() => (source?.key === sourceKey ? source.rows : []), [source, sourceKey])

  // One drawing per tile for the chosen style, size, and bleed (the PDF repeats them by quantity).
  const arts = useMemo(() => {
    const map = new Map<number, CircleArt>()
    if (font)
      for (const row of rows)
        map.set(
          row.tileId,
          options.shape === 'hex'
            ? tileHex(font, row.definitionCode, row.color, row.number, options.diameterInches, options.bleedInches)
            : crossingSign(font, row.number, row.color, options.diameterInches, options.bleedInches),
        )
    return map
  }, [font, rows, options.shape, options.diameterInches, options.bleedInches])

  const quantityOf = (row: CircleRow) => {
    const typed = quantities[row.tileId]
    if (typed === undefined) return DEFAULT_QUANTITY
    const n = Number(typed)
    return Number.isInteger(n) && n >= 0 && n <= MAX_QUANTITY ? n : 0
  }

  const checkedRows = rows.filter((row) => !unchecked[row.tileId])
  const printList = checkedRows.flatMap((row) => Array<CircleArt>(quantityOf(row)).fill(arts.get(row.tileId)!)).filter(Boolean)
  // Colors this game uses, in the usual order, for the "Only ..." buttons.
  const colors = TILE_COLORS.filter((c) => rows.some((row) => row.color === c))
  const selectOnly = (keep: (row: CircleRow) => boolean) => setUnchecked(Object.fromEntries(rows.filter((row) => !keep(row)).map((row) => [row.tileId, true])))
  const layout = sheetLayout(options)
  const pageCount = layout.perPage > 0 ? Math.ceil(printList.length / layout.perPage) : 0
  const shownPage = Math.min(previewPage, Math.max(0, pageCount - 1))
  const hex = options.shape === 'hex'
  // The small-number warning is for number circles; on the tile picture the number is a small label by design.
  const tooSmall = hex ? [] : checkedRows.filter((row) => (arts.get(row.tileId)?.numberPoints ?? 99) < MIN_NUMBER_POINTS)
  const noun = (n: number) => (n === 1 ? 'sticker' : 'stickers')
  const selected = rows.find((r) => r.tileId === selectedId) ?? rows[0]
  const selectedArt = selected ? arts.get(selected.tileId) : undefined

  const setOption = <K extends keyof SheetOptions>(key: K, value: SheetOptions[K]) => setOptions({ ...options, [key]: value })
  // The tile picture comes in 3/4 and 1 inch; switching to it from 1/2 inch sets 1 inch (switching back keeps the size).
  const setShape = (shape: StickerShape) =>
    setOptions({ ...options, shape, diameterInches: shape === 'hex' && !HEX_SIZES.includes(options.diameterInches) ? 1 : options.diameterInches })
  // Margins and spacing in inches, typed as text; values outside the range are ignored.
  const setInches = (key: 'marginInches' | 'spacingInches', text: string, max: number) => {
    const n = Number(text)
    if (text !== '' && Number.isFinite(n) && n >= 0 && n <= max) setOption(key, n)
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  const downloadPdf = () =>
    run(async () => {
      const bytes = await buildSheetPdf(printList, options, `${source!.title} tile ${hex ? 'pictures' : 'numbers'}`)
      downloadBlob(new Blob([bytes.slice()], { type: 'application/pdf' }), `${fileSafe(source!.title)}-tile-${hex ? 'pictures' : 'numbers'}.pdf`)
    })
  const downloadSvg = () =>
    run(async () => downloadBlob(new Blob([circleSvg(selectedArt!, options.diameterInches)], { type: 'image/svg+xml' }), `${fileSafe(selected!.number)}.svg`))
  const downloadPng = () => run(async () => downloadBlob(await circlePng(selectedArt!, options.diameterInches), `${fileSafe(selected!.number)}.png`))

  if (!sourceKey) {
    return (
      <div className="space-y-2">
        <PageHeader
          icon={Printer}
          area="contribute"
          title="Print tile stickers"
          description="Open this page from a tile or from a game's tile list (Print tray stickers)."
        />
        <Link to="/" className="text-sm underline">
          Browse games
        </Link>
      </div>
    )
  }
  if (error && rows.length === 0) return <p className="text-destructive">Could not load the tiles. {error}</p>
  if (rows.length === 0 || !font) return <LoadingState label="Loading…" />

  const pageArts = printList.slice(shownPage * layout.perPage, (shownPage + 1) * layout.perPage)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Printer}
        area="contribute"
        title={`Print tile stickers: ${source!.title}`}
        description={
          hex
            ? 'A picture of each tile on a hex, for tile trays. Download a PDF sheet to print on paper or labels, or one sticker as SVG or PNG.'
            : "Crossing-sign circles with each tile's number, for tile trays. Download a PDF sheet to print on paper or round labels, or one circle as SVG or PNG."
        }
      />

      {/* Sheet settings. */}
      <div className="flex flex-wrap items-end gap-4 text-sm">
        <label className="space-y-1">
          <span className="block text-muted-foreground">Sticker</span>
          <NativeSelect value={options.shape} onChange={(e) => setShape(e.target.value as StickerShape)}>
            {STYLES.map((s) => (
              <NativeSelectOption key={s.shape} value={s.shape}>
                {s.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1">
          <span className="block text-muted-foreground">{hex ? 'Size (across the flats)' : 'Size'}</span>
          <NativeSelect value={options.diameterInches} onChange={(e) => setOption('diameterInches', Number(e.target.value))}>
            {SIZES.filter((s) => !hex || HEX_SIZES.includes(s.inches)).map((s) => (
              <NativeSelectOption key={s.inches} value={s.inches}>
                {s.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1">
          <span className="block text-muted-foreground">Paper</span>
          <NativeSelect value={options.paper} onChange={(e) => setOption('paper', e.target.value as Paper)}>
            {Object.entries(PAPER_SIZES).map(([key, p]) => (
              <NativeSelectOption key={key} value={key}>
                {p.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1">
          <span className="block text-muted-foreground">Margins (in)</span>
          <Input
            type="number"
            min={0}
            max={2}
            step={0.125}
            defaultValue={options.marginInches}
            onChange={(e) => setInches('marginInches', e.target.value, 2)}
            className="w-24"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-muted-foreground">Spacing (in)</span>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.0625}
            defaultValue={options.spacingInches}
            onChange={(e) => setInches('spacingInches', e.target.value, 1)}
            className="w-24"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-muted-foreground">Bleed</span>
          <NativeSelect value={options.bleedInches} onChange={(e) => setOption('bleedInches', Number(e.target.value))}>
            {BLEEDS.map((b) => (
              <NativeSelectOption key={b.label} value={b.inches}>
                {b.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input type="checkbox" checked={options.cutLine} onChange={(e) => setOption('cutLine', e.target.checked)} />
          Cut line
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Tiles and quantities. Click a row to preview it and download that one circle. */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {gameId && `${checkedRows.length} of ${rows.length} tiles · `}
            {printList.length} {noun(printList.length)} on {pageCount} {pageCount === 1 ? 'page' : 'pages'} ({layout.columns} x {layout.rows} per page).
            {gameId && ' One sticker per tile to start, for its slot in a storage tray; change any quantity if you need more.'}
          </p>
          {hex && (
            <p className="text-sm font-medium text-destructive">
              Very busy tiles may look jumbled on a tile picture sticker, especially at 3/4 inch. Check them in the preview before printing.
            </p>
          )}
          {/* Quick selection for a game: everything, nothing, or only one color (for example only the green tiles). */}
          {gameId && rows.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Select</span>
              <Button variant="outline" size="sm" onClick={() => setUnchecked({})}>
                All
              </Button>
              <Button variant="outline" size="sm" onClick={() => selectOnly(() => false)}>
                None
              </Button>
              {colors.length > 1 && <span className="ml-2 text-muted-foreground">Only</span>}
              {colors.length > 1 &&
                colors.map((c) => (
                  <Button key={c} variant="outline" size="sm" onClick={() => selectOnly((row) => row.color === c)}>
                    <span className="inline-flex size-3 overflow-hidden rounded-full border border-black/30" aria-hidden="true">
                      {tileFills(c).map((fill) => (
                        <span key={fill} className="h-full flex-1" style={{ backgroundColor: fill }} />
                      ))}
                    </span>
                    {colorName(c)}
                  </Button>
                ))}
            </div>
          )}
          {layout.perPage === 0 && <p className="text-sm text-destructive">Nothing fits on the page. Use smaller margins or a smaller size.</p>}
          {tooSmall.length > 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              {tooSmall.length === 1 ? 'One number prints' : `${tooSmall.length} numbers print`} under {MIN_NUMBER_POINTS} pt at this size and may be hard to
              read: {tooSmall.map((r) => r.number).join(', ')}. Choose a larger size for these.
            </p>
          )}
          <ul className="divide-y rounded-lg border">
            {rows.map((row) => {
              const art = arts.get(row.tileId)!
              const small = art.numberPoints < MIN_NUMBER_POINTS
              const checked = !unchecked[row.tileId]
              return (
                <li
                  key={row.tileId}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted ${row.tileId === selected?.tileId ? 'bg-muted' : ''}`}
                  onClick={() => setSelectedId(row.tileId)}
                >
                  {/* Include this tile on the sheet. A click here does not also select the row for the preview. */}
                  {gameId && (
                    <input
                      type="checkbox"
                      className="size-4 shrink-0"
                      checked={checked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setUnchecked({ ...unchecked, [row.tileId]: !e.target.checked })}
                      aria-label={`Print ${row.displayName}`}
                    />
                  )}
                  <NumberCircle art={art} className={`shrink-0 ${hex ? 'w-12' : 'size-10'} ${checked ? '' : 'opacity-40'}`} label={`Tile ${row.number}`} />
                  <span className={`min-w-0 flex-1 ${checked ? '' : 'opacity-50'}`}>
                    <span className="font-medium">{row.displayName}</span>
                    {gameId && <span className="text-muted-foreground"> · {countText(row.count)}</span>}
                    {small && !hex && <span className="text-amber-700"> · {art.numberPoints.toFixed(1)} pt</span>}
                  </span>
                  <label className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-muted-foreground">Print</span>
                    <Input
                      type="number"
                      min={0}
                      max={MAX_QUANTITY}
                      value={quantities[row.tileId] ?? String(DEFAULT_QUANTITY)}
                      onChange={(e) => setQuantities({ ...quantities, [row.tileId]: e.target.value })}
                      className="w-20"
                      aria-label={`How many of ${row.displayName}`}
                    />
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        {/* The selected sticker at actual size and enlarged, single-sticker downloads, the PDF, and a page preview. */}
        <div className="space-y-4">
          {selected && selectedArt && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-4">
                <NumberCircle art={selectedArt} className={hex ? 'w-36' : 'size-32'} label={`Tile ${selected.number}, enlarged`} />
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{selected.displayName}</div>
                  {/* Width in CSS inches: about actual size on most screens at 100% zoom. */}
                  <div style={{ width: `${(options.diameterInches * extentX(selectedArt)) / 50}in` }}>
                    <NumberCircle art={selectedArt} className="w-full" label={`Tile ${selected.number}, actual size`} />
                  </div>
                  <div className="text-xs text-muted-foreground">Actual size{hex ? '' : ` · number ${selectedArt.numberPoints.toFixed(1)} pt`}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void downloadSvg()}>
                  Download SVG
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void downloadPng()}>
                  Download PNG (300 DPI)
                </Button>
              </div>
            </div>
          )}

          <Button className="w-full" disabled={busy || printList.length === 0 || layout.perPage === 0} onClick={() => void downloadPdf()}>
            {busy ? 'Working…' : `Download PDF (${printList.length} ${noun(printList.length)}, ${pageCount} ${pageCount === 1 ? 'page' : 'pages'})`}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}

          {pageCount > 0 && (
            <div className="space-y-2">
              <SheetPreview arts={pageArts} layout={layout} diameterPoints={options.diameterInches * 72} cutLine={options.cutLine} />
              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <Button variant="outline" size="sm" disabled={shownPage === 0} onClick={() => setPreviewPage(shownPage - 1)}>
                    Previous
                  </Button>
                  <span>
                    Page {shownPage + 1} of {pageCount}
                  </span>
                  <Button variant="outline" size="sm" disabled={shownPage >= pageCount - 1} onClick={() => setPreviewPage(shownPage + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
