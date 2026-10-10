import { Link } from 'react-router'
import { MapPinOff } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
// Shown for any URL that matches no route.
export default function NotFoundPage() {
  return (
    <div className="space-y-4">
      <PageHeader icon={MapPinOff} title="Page not found" description="There is no page at this address." />
      <Link to="/" className="text-sm underline">
        Go to the games
      </Link>
    </div>
  )
}
