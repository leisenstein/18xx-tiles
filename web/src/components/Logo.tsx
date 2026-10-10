import { cn } from '@/lib/utils'

// The site's mark (chosen after Phase 4, option B): a fanned stack of brown, green, and yellow tiles, like the yellow -> green -> brown upgrades in
// every 18xx game. The top tile has a straight track through a city and a revenue badge. Drawn like the tiles themselves (style B, DESIGN.md
// section 10): deep fills, dark edges, a light inner ring, and track on a light casing.
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('size-11', className)} aria-hidden="true">
      {/* Brown tile, at the back. */}
      <polygon points="66,62 51,87.98 21,87.98 6,62 21,36.02 51,36.02" fill="#B9814B" stroke="#4D3018" strokeWidth="2.1" strokeLinejoin="round" />
      <polygon points="62.4,62 49.2,84.86 22.8,84.86 9.6,62 22.8,39.14 49.2,39.14" fill="none" stroke="#E3CDB7" strokeWidth="0.75" />
      {/* Green tile, in the middle. */}
      <polygon points="80,48 65,73.98 35,73.98 20,48 35,22.02 65,22.02" fill="#5FAE57" stroke="#2B4E27" strokeWidth="2.1" strokeLinejoin="round" />
      <polygon points="76.4,48 63.2,70.86 36.8,70.86 23.6,48 36.8,25.14 63.2,25.14" fill="none" stroke="#B7DBB3" strokeWidth="0.75" />
      {/* Yellow tile, on top: track, city, and revenue. */}
      <polygon points="94,36 79,61.98 49,61.98 34,36 49,10.02 79,10.02" fill="#F2C230" stroke="#6D5716" strokeWidth="2.1" strokeLinejoin="round" />
      <polygon points="90.4,36 77.2,58.86 50.8,58.86 37.6,36 50.8,13.14 77.2,13.14" fill="none" stroke="#FAE7A6" strokeWidth="0.75" />
      <line x1="64" y1="11.2" x2="64" y2="60.8" stroke="#FFF8DC" strokeWidth="8" />
      <line x1="64" y1="11.2" x2="64" y2="60.8" stroke="#1A1A1A" strokeWidth="5" />
      <circle cx="64" cy="36" r="8.5" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="2.4" />
      <circle cx="80" cy="22" r="6" fill="#1A1A1A" />
      <text x="80" y="24.6" textAnchor="middle" fontSize="7" fontWeight="700" fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif">
        20
      </text>
    </svg>
  )
}
