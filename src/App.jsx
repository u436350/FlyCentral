import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import SearchPage from './pages/SearchPage'
import BookingsPage from './pages/BookingsPage'
import FareWatchPage from './pages/FareWatchPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AlertsPage from './pages/AlertsPage'
import BillingPage from './pages/BillingPage'
import AdminPage from './pages/AdminPage'
import ProfilePage from './pages/ProfilePage'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

function PrivateRoute({ children, roles }) {
  const { token, role } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { token } = useAuthStore()
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <Routes>
          <Route path="/login"    element={token ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/register" element={token ? <Navigate to="/" /> : <RegisterPage />} />
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="search"           element={<PrivateRoute roles={['agent','supervisor','admin']}><SearchPage /></PrivateRoute>} />
            <Route path="bookings"         element={<PrivateRoute roles={['agent','supervisor','admin']}><BookingsPage /></PrivateRoute>} />
            <Route path="fare-watch"       element={<PrivateRoute roles={['agent','supervisor','admin']}><FareWatchPage /></PrivateRoute>} />
            <Route path="analytics"        element={<PrivateRoute roles={['agent','supervisor','finance','admin']}><AnalyticsPage /></PrivateRoute>} />
            <Route path="alerts"           element={<PrivateRoute roles={['agent','supervisor','admin']}><AlertsPage /></PrivateRoute>} />
            <Route path="billing"          element={<PrivateRoute roles={['finance','admin']}><BillingPage /></PrivateRoute>} />
            <Route path="admin"            element={<PrivateRoute roles={['admin']}><AdminPage /></PrivateRoute>} />
            <Route path="profile"          element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
