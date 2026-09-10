import { Navigate, Route, Routes } from 'react-router-dom'
import { partnerApi } from '../../lib/api.js'
import { PartnerLogin } from './PartnerLogin.jsx'
import { PartnerDashboard } from './PartnerDashboard.jsx'
import styles from './partner.module.css'

function RequireToken({ children }) {
  if (!partnerApi.getToken()) return <Navigate to="/parceiro/login" replace />
  return children
}

export function PartnerArea() {
  const hasToken = Boolean(partnerApi.getToken())
  return (
    <div className={styles.area}>
      <Routes>
        <Route index element={<Navigate to={hasToken ? '/parceiro/painel' : '/parceiro/login'} replace />} />
        <Route path="login" element={hasToken ? <Navigate to="/parceiro/painel" replace /> : <PartnerLogin />} />
        <Route
          path="painel/*"
          element={
            <RequireToken>
              <PartnerDashboard />
            </RequireToken>
          }
        />
        <Route path="*" element={<Navigate to="/parceiro" replace />} />
      </Routes>
    </div>
  )
}
