import { useParams } from 'react-router'

// Placeholder until Step 2.7. Shows the id from the URL to prove routing works.
// useParams() reads the ":id" part of the route "tiles/:id", so /tiles/60 shows "Tile 60".
export default function TileDetailPage() {
  const { id } = useParams()
  return <h1 className="text-2xl font-semibold">Tile {id}</h1>
}
