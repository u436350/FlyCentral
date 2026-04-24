import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api, { isDemoFallbackEnabled } from '../lib/api'
import toast from 'react-hot-toast'
import { Plane } from 'lucide-react'

const DEMO_FALLBACK_ENABLED = isDemoFallbackEnabled()

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const nav = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      login(data)
      nav('/')
    } catch (err) {
      const status = err.response?.status
      const isBackendUnavailable = !err.response || status === 0 || status >= 500 || status === 404
      const isWrongCredentials = status === 401 || status === 403
      const isAgentDemo = email.trim().toLowerCase() === 'agent@berlin.com' && password === 'demo1234'
      const isAdminDemo = email.trim().toLowerCase() === 'admin@flycentral.com' && password === 'admin1234'

      if (isWrongCredentials) {
        toast.error('E-Mail oder Passwort falsch.')
      } else if (DEMO_FALLBACK_ENABLED && isBackendUnavailable && (isAgentDemo || isAdminDemo)) {
        login({
          access_token: `offline-demo-${Date.now()}`,
          role: isAdminDemo ? 'admin' : 'agent',
          email: email.trim().toLowerCase(),
          tenant_id: 1,
        })
        toast.success('Demo Modus aktiv (Backend nicht erreichbar)')
        nav('/')
      } else if (DEMO_FALLBACK_ENABLED && isBackendUnavailable) {
        toast.error('Backend nicht erreichbar. Bitte Demo-Zugangsdaten verwenden.')
      } else {
        toast.error(err.response?.data?.error || err.message || 'Ein Fehler ist aufgetreten.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-teal-600 text-white p-2 rounded-xl"><Plane size={22} /></div>
          <div>
            <h1 className="font-bold text-xl text-slate-800">FlyCentral</h1>
            <p className="text-xs text-slate-500">Travel Agency Platform</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-Mail</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="agent@berlin.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Passwort</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Noch kein Konto?{' '}
          <Link to="/register" className="text-teal-600 font-medium hover:underline">Jetzt registrieren</Link>
        </p>
        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
          <p><strong>Demo:</strong> agent@berlin.com / demo1234</p>
          <p><strong>Admin:</strong> admin@flycentral.com / admin1234</p>
        </div>
      </div>
    </div>
  )
}
