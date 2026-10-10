import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import Layout from '@/components/Layout'
import RequireRole from '@/components/RequireRole'
import { ADMIN_ROLE } from '@/lib/constants'
import AdminHistoryPage from '@/pages/AdminHistoryPage'
import EditGameTilesPage from '@/pages/EditGameTilesPage'
import AdminImportsPage from '@/pages/AdminImportsPage'
import AdminQueuePage from '@/pages/AdminQueuePage'
import CommonTilesPage from '@/pages/CommonTilesPage'
import DevTilesPage from '@/pages/DevTilesPage'
import EditTilePage from '@/pages/EditTilePage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import MyRequestsPage from '@/pages/MyRequestsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import RegisterPage from '@/pages/RegisterPage'
import SubmitTilePage from '@/pages/SubmitTilePage'
import TileDetailPage from '@/pages/TileDetailPage'
import TilesPage from '@/pages/TilesPage'

// The print page pulls in the PDF and font libraries (about 1 MB), so it loads only when opened instead of with every page.
const PrintCirclesPage = lazy(() => import('@/pages/PrintCirclesPage'))

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tiles" element={<TilesPage />} />
        <Route path="tiles/common" element={<CommonTilesPage />} />
        {/* Printable tile number circles (DESIGN.md 9.4): ?tile=ID or ?game=ID. Signed-in users only (any role). */}
        <Route
          path="print/circles"
          element={
            <RequireRole>
              <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
                <PrintCirclesPage />
              </Suspense>
            </RequireRole>
          }
        />
        <Route path="tiles/:id" element={<TileDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        {/* Pages for any signed-in user: RequireRole without a role sends visitors to /login first. */}
        <Route
          path="submit"
          element={
            <RequireRole>
              <SubmitTilePage />
            </RequireRole>
          }
        />
        <Route
          path="tiles/:id/edit"
          element={
            <RequireRole role={ADMIN_ROLE}>
              <EditTilePage />
            </RequireRole>
          }
        />
        <Route
          path="account/requests"
          element={
            <RequireRole>
              <MyRequestsPage />
            </RequireRole>
          }
        />
        {/* Admin pages: RequireRole sends visitors to /login and refuses non-admins. */}
        <Route
          path="admin/queue"
          element={
            <RequireRole role={ADMIN_ROLE}>
              <AdminQueuePage />
            </RequireRole>
          }
        />
        <Route
          path="admin/games/:id/tiles"
          element={
            <RequireRole role={ADMIN_ROLE}>
              <EditGameTilesPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/history"
          element={
            <RequireRole role={ADMIN_ROLE}>
              <AdminHistoryPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/imports"
          element={
            <RequireRole role={ADMIN_ROLE}>
              <AdminImportsPage />
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
