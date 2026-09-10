import { Navigate, Route, Routes } from 'react-router-dom'
import { b2bApi } from '../../lib/api.js'
import { B2BLogin } from './B2BLogin.jsx'
import { B2BDashboard } from './B2BDashboard.jsx'
import { B2BClassDetail } from './B2BClassDetail.jsx'

function RequireB2B({ children }) {
  if (!b2bApi.getToken()) return <Navigate to="/b2b/login" replace />
  return children
}

export function B2BArea() {
  return (
    <Routes>
      <Route index element={<Navigate to={b2bApi.getToken() ? 'painel' : 'login'} replace />} />
      <Route path="login" element={<B2BLogin />} />
      <Route
        path="painel"
        element={
          <RequireB2B>
            <B2BDashboard />
          </RequireB2B>
        }
      />
      <Route
        path="painel/turmas/:id"
        element={
          <RequireB2B>
            <B2BClassDetail />
          </RequireB2B>
        }
      />
      <Route path="*" element={<Navigate to="/b2b" replace />} />
    </Routes>
  )
}
