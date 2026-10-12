import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { TileFilterKey, TileFilters } from '@/hooks/useTileFilters'
import { TILE_COLORS } from '@/lib/tiles/colors'
import type { GameSummary } from '@/types/game'

interface FilterBarProps {
  filters: TileFilters
  games: GameSummary[]
  onChange: (key: TileFilterKey, value: string | number | undefined) => void
}

// The three "kind" choices; undefined means no filter.
const KINDS: { value: 'city' | 'town' | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'city', label: 'Cities' },
  { value: 'town', label: 'Towns' },
]

// Exits choices: how many of the hex's sides track leaves from.
const EXITS = [0, 1, 2, 3, 4, 5, 6]

// Filters for the tile list: game, color, city/town, exits, and number search.
// It only shows the current filters and reports changes; useTileFilters stores them in the URL.
export default function FilterBar({ filters, games, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <NativeSelect aria-label="Game" value={filters.game ?? ''} onChange={(e) => onChange('game', e.target.value ? Number(e.target.value) : undefined)}>
        <NativeSelectOption value="">All games</NativeSelectOption>
        {games.map((game) => (
          <NativeSelectOption key={game.id} value={game.id}>
            {game.title}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <NativeSelect aria-label="Color" value={filters.color ?? ''} onChange={(e) => onChange('color', e.target.value || undefined)}>
        <NativeSelectOption value="">All colors</NativeSelectOption>
        {TILE_COLORS.map((color) => (
          <NativeSelectOption key={color} value={color}>
            {color}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Exits"
        value={filters.exits ?? ''}
        onChange={(e) => onChange('exits', e.target.value === '' ? undefined : Number(e.target.value))}
      >
        <NativeSelectOption value="">Any exits</NativeSelectOption>
        {EXITS.map((n) => (
          <NativeSelectOption key={n} value={n}>
            {n} {n === 1 ? 'exit' : 'exits'}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {/* City/town toggle: the selected choice uses the filled button style. */}
      <div className="flex gap-1" role="group" aria-label="Cities or towns">
        {KINDS.map((kind) => (
          <Button
            key={kind.label}
            size="sm"
            variant={filters.kind === kind.value ? 'default' : 'outline'}
            aria-pressed={filters.kind === kind.value}
            onClick={() => onChange('kind', kind.value)}
          >
            {kind.label}
          </Button>
        ))}
      </div>

      <Input
        type="search"
        aria-label="Tile number"
        placeholder="Tile number, e.g. 57"
        maxLength={20}
        className="w-48"
        value={filters.q ?? ''}
        onChange={(e) => onChange('q', e.target.value)}
      />
    </div>
  )
}
