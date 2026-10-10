import { Route, Routes } from 'react-router'
import Layout from '@/components/Layout'
import CommonTilesPage from '@/pages/CommonTilesPage'
import DevTilesPage from '@/pages/DevTilesPage'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import TileDetailPage from '@/pages/TileDetailPage'
import TilesPage from '@/pages/TilesPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tiles" element={<TilesPage />} />
        <Route path="tiles/common" element={<CommonTilesPage />} />
        <Route path="tiles/:id" element={<TileDetailPage />} />
        {/* Development-only page for checking tile drawings (not in production builds). */}
        {import.meta.env.DEV && (
          <Route path="dev/tiles" element={<DevTilesPage />} />
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
