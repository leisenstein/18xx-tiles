import { Route, Routes } from 'react-router'
import Layout from '@/components/Layout'
import RequireRole from '@/components/RequireRole'
import { ADMIN_ROLE } from '@/lib/constants'
import AdminQueuePage from '@/pages/AdminQueuePage'
import CommonTilesPage from '@/pages/CommonTilesPage'
import DevTilesPage from '@/pages/DevTilesPage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'
import RegisterPage from '@/pages/RegisterPage'
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
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        {/* Admin pages: RequireRole sends visitors to /login and refuses non-admins. */}
        <Route
          path="admin/queue"
          element={
            <RequireRole role={ADMIN_ROLE}>
              <AdminQueuePage />
            </RequireRole>
          }
        />
        {/* Development-only page for checking tile drawings (not in production builds). */}
        {import.meta.env.DEV && <Route path="dev/tiles" element={<DevTilesPage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
