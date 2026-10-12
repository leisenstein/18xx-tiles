import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router'
import Layout from '@/components/Layout'
import LoadingState from '@/components/LoadingState'
import RequireRole from '@/components/RequireRole'
import { ADMIN_ROLE } from '@/lib/constants'
import AboutPage from '@/pages/AboutPage'
import AccountPage from '@/pages/AccountPage'
import AdminDocsPage from '@/pages/AdminDocsPage'
import AdminHistoryPage from '@/pages/AdminHistoryPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import GameFormPage from '@/pages/GameFormPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import EditGameTilesPage from '@/pages/EditGameTilesPage'
import AdminImportsPage from '@/pages/AdminImportsPage'
import AdminQueuePage from '@/pages/AdminQueuePage'
import AdminUsersPage from '@/pages/AdminUsersPage'
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
        <Route path="about" element={<AboutPage />} />
        {/* Printable tile number circles (DESIGN.md 9.4): ?tile=ID or ?game=ID. Signed-in users only (any role). */}
        <Route
          path="print/circles"
          element={
            <RequireRole>
              <Suspense fallback={<LoadingState />}>
                <PrintCirclesPage />
              </Suspense>
            </RequireRole>
          }
        />
        <Route path="tiles/:id" element={<TileDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
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
          path="account"
          element={
            <RequireRole>
              <AccountPage />
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
          path="admin/games/new"
          element={
            <RequireRole role={ADMIN_ROLE}>
              <GameFormPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/games/:id/edit"
          element={
            <RequireRole role={ADMIN_ROLE}>
              {/* key: a fresh form when moving from one game to another */}
              <GameFormKeyed />
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
        <Route path="admin/docs" element={<Navigate to="/admin/docs/runbook" replace />} />
        <Route
          path="admin/docs/:name"
          element={
            <RequireRole role={ADMIN_ROLE}>
              <AdminDocsPage />
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
          path="admin/users"
          element={
            <RequireRole role={ADMIN_ROLE}>
              <AdminUsersPage />
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

// The Edit game form, remounted for each game id so its fields start from that game.
function GameFormKeyed() {
  const { id } = useParams()
  return <GameFormPage key={id} />
}
