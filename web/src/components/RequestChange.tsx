import GameProposalView from '@/components/GameProposalView'
import TileChange from '@/components/TileChange'
import type { ChangeRequest } from '@/types/changeRequest'

// What a change request changes: the proposed game for a game proposal (AddGame), otherwise the tile's before and after drawings.
export default function RequestChange({ request }: { request: ChangeRequest }) {
  return request.type === 'AddGame' ? <GameProposalView request={request} /> : <TileChange request={request} />
}
