import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Small "turn 60 degrees clockwise" button for tile drawings (TileSvg's rotation). Used on the tile cards and the tile page.
export default function RotateButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn('bg-background/90', className)}
      onClick={onClick}
      title="Rotate 60° clockwise"
      aria-label="Rotate 60 degrees clockwise"
    >
      <RotateCw aria-hidden="true" />
    </Button>
  )
}
