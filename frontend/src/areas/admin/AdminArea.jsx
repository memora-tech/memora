import { Navigate, Route, Routes } from 'react-router-dom'
import { adminApi } from '../../lib/api.js'
import { AdminLogin } from './AdminLogin.jsx'
import { AdminLayout, AdminHome } from './AdminLayout.jsx'
import { Moderation } from './Moderation.jsx'
import { ModerationDetail } from './ModerationDetail.jsx'
import { Reports } from './Reports.jsx'
import { Appeals } from './Appeals.jsx'
import { Support } from './Support.jsx'
import { Commercial } from './Commercial.jsx'
import { Finance } from './Finance.jsx'
import { Compliance } from './Compliance.jsx'
import { Engineering } from './Engineering.jsx'
import { Team } from './Team.jsx'

function RequireAdmin({ children }) {
  if (!adminApi.getToken()) return <Navigate to="/admin/login" replace />
  return children
}

export function AdminArea() {
  return (
    <Routes>
      <Route index element={<Navigate to={adminApi.getToken() ? 'painel' : 'login'} replace />} />
      <Route path="login" element={<AdminLogin />} />
      <Route
        path="painel"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="moderacao" element={<Moderation />} />
        <Route path="moderacao/:id" element={<ModerationDetail />} />
        <Route path="denuncias" element={<Reports />} />
        <Route path="contestacoes" element={<Appeals />} />
        <Route path="suporte" element={<Support />} />
        <Route path="comercial" element={<Commercial />} />
        <Route path="financeiro" element={<Finance />} />
        <Route path="compliance" element={<Compliance />} />
        <Route path="engenharia" element={<Engineering />} />
        <Route path="equipe" element={<Team />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
