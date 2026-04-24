import { useState } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { useAuthStore } from '../store/authStore'
import { User, Lock, Shield, Mail } from 'lucide-react'

const ROLE_LABELS = {
  agent:      { label: 'Agent',      color: 'bg-blue-100 text-blue-700' },
  supervisor: { label: 'Supervisor', color: 'bg-purple-100 text-purple-700' },
  finance:    { label: 'Finance',    color: 'bg-emerald-100 text-emerald-700' },
  admin:      { label: 'Admin',      color: 'bg-red-100 text-red-700' },
}

export default function ProfilePage() {
  const { email, role } = useAuthStore()
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setPwForm(f => ({ ...f, [k]: e.target.value }))

  async function changePassword(e) {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) {
      return toast.error('Neues Passwort stimmt nicht überein')
    }
    if (pwForm.new_password.length < 8) {
      return toast.error('Passwort muss mindestens 8 Zeichen lang sein')
    }
    setSaving(true)
    try {
      await api.post('/auth/change-password', {
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
      })
      toast.success('Passwort erfolgreich geändert!')
      setPwForm({ old_password: '', new_password: '', confirm: '' })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const roleInfo = ROLE_LABELS[role] || { label: role, color: 'bg-slate-100 text-slate-700' }

  const PERMISSIONS = {
    agent:      ['Flüge suchen', 'Buchungen erstellen', 'Buchungen verwalten', 'Preisalarme'],
    supervisor: ['Alles von Agent', 'Ticketierte Buchungen stornieren', 'Alle Buchungen des Tenants sehen'],
    finance:    ['Analytics', 'Rechnungen einsehen', 'CSV-Export'],
    admin:      ['Vollzugriff', 'Tenants verwalten', 'Nutzer verwalten', 'Audit-Logs', 'Live-Monitor', 'Billing'],
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-800">👤 Mein Profil</h1>

      {/* Account info */}
      <Card>
        <h2 className="font-semibold text-slate-700 mb-4">Kontoinformationen</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Mail size={18} className="text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">E-Mail</p>
              <p className="font-medium text-slate-800">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Shield size={18} className="text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Rolle</p>
              <span className={`inline-block text-sm font-semibold px-2 py-0.5 rounded-full ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Permissions */}
      <Card>
        <h2 className="font-semibold text-slate-700 mb-3">Berechtigungen</h2>
        <ul className="space-y-1.5">
          {(PERMISSIONS[role] || []).map(p => (
            <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="text-teal-500">✓</span> {p}
            </li>
          ))}
        </ul>
      </Card>

      {/* Change password */}
      <Card>
        <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Lock size={17} /> Passwort ändern
        </h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Aktuelles Passwort</label>
            <input
              type="password"
              required
              value={pwForm.old_password}
              onChange={set('old_password')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Neues Passwort</label>
            <input
              type="password"
              required
              value={pwForm.new_password}
              onChange={set('new_password')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Mindestens 8 Zeichen"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Passwort bestätigen</label>
            <input
              type="password"
              required
              value={pwForm.confirm}
              onChange={set('confirm')}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                pwForm.confirm && pwForm.confirm !== pwForm.new_password
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-300'
              }`}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {pwForm.confirm && pwForm.confirm !== pwForm.new_password && (
              <p className="text-xs text-red-500 mt-1">Passwörter stimmen nicht überein</p>
            )}
          </div>
          <Btn
            type="submit"
            disabled={saving || (pwForm.confirm && pwForm.confirm !== pwForm.new_password)}
          >
            {saving ? 'Speichere…' : '🔒 Passwort ändern'}
          </Btn>
        </form>
      </Card>
    </div>
  )
}
