import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Plane } from 'lucide-react'

export default function RegisterPage() {
  const [form, setForm]   = useState({ agency_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const nav = useNavigate()

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', form)
      login(data)
      toast.success('Konto erstellt!')
      nav('/')
    } catch (err) {
      toast.error(err.message)
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
            <h1 className="font-bold text-xl text-slate-800">Konto erstellen</h1>
            <p className="text-xs text-slate-500">Kostenlos registrieren</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'agency_name', label: 'Agenturname', type: 'text', placeholder: 'Berlin Travels GmbH' },
            { key: 'email',       label: 'E-Mail',       type: 'email', placeholder: 'chef@meineagentur.de' },
            { key: 'password',    label: 'Passwort',     type: 'password', placeholder: 'min. 8 Zeichen' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type={type} required value={form[key]} onChange={set(key)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder={placeholder}
              />
            </div>
          ))}
          <button
            type="submit" disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Erstelle Konto…' : 'Registrieren'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Bereits registriert?{' '}
          <Link to="/login" className="text-teal-600 font-medium hover:underline">Anmelden</Link>
        </p>
      </div>
    </div>
  )
}
