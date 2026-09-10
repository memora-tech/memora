import { Navigate, Route, Routes } from 'react-router-dom'
import { parentalApi } from '../../lib/api.js'
import { ParentalLogin } from './ParentalLogin.jsx'
import { ParentalDashboard } from './ParentalDashboard.jsx'
import styles from './parental.module.css'

function RequireToken({ children }) {
  if (!parentalApi.getToken()) return <Navigate to="/parental/login" replace />
  return children
}

export function ParentalArea() {
  const hasToken = Boolean(parentalApi.getToken())
  return (
    <div className={styles.area}>
      <Routes>
        <Route index element={<Navigate to={hasToken ? '/parental/painel' : '/parental/login'} replace />} />
        <Route path="login" element={hasToken ? <Navigate to="/parental/painel" replace /> : <ParentalLogin />} />
        <Route
          path="painel/*"
          element={
            <RequireToken>
              <ParentalDashboard />
            </RequireToken>
          }
        />
        <Route path="*" element={<Navigate to="/parental" replace />} />
      </Routes>
    </div>
  )
}
