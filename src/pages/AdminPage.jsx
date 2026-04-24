import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { Shield, Users, Building2, Activity, RefreshCw } from 'lucide-react'

function fmtDt(s) {
  return s ? new Date(s).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–'
}

export default function AdminPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('tenants')
  const [billingLoading, setBillingLoading] = useState(false)
  const [newTenant, setNewTenant]   = useState({ name: '', email: '', markup_percent: 15 })
  const [markupEdit, setMarkupEdit] = useState({})

  const { data: tenants, refetch: refetchTenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn:  () => api.get('/admin/tenants').then(r => r.data),
    enabled:  tab === 'tenants',
  })
  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn:  () => api.get('/admin/users').then(r => r.data),
    enabled:  tab === 'users',
  })
  const { data: audit, refetch: refetchAudit } = useQuery({
    queryKey: ['admin-audit'],
    queryFn:  () => api.get('/admin/audit').then(r => r.data),
    enabled:  tab === 'audit',
  })
  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ['live-events'],
    queryFn:  () => api.get('/live-events').then(r => r.data),
    enabled:  tab === 'monitor',
    refetchInterval: tab === 'monitor' ? 5_000 : false,
  })

  async function runBilling() {
    setBillingLoading(true)
    try {
      const { data } = await api.post('/admin/billing/run')
      toast.success(`Billing abgeschlossen · ${data.invoices_created} Rechnung(en) erstellt`)
    } catch (err) { toast.error(err.message) }
    finally { setBillingLoading(false) }
  }

  async function createTenant(e) {
    e.preventDefault()
    try {
      await api.post('/admin/tenants', newTenant)
      toast.success('Tenant erstellt')
      setNewTenant({ name: '', email: '', markup_percent: 15 })
      refetchTenants()
    } catch (err) { toast.error(err.message) }
  }

  async function saveMarkup(tenantId) {
    const val = markupEdit[tenantId]
    if (val == null) return
    try {
      await api.put(`/admin/tenants/${tenantId}`, { markup_percent: parseFloat(val) })
      toast.success('Aufschlag gespeichert')
      setMarkupEdit(m => { const c = {...m}; delete c[tenantId]; return c })
      refetchTenants()
    } catch (err) { toast.error(err.message) }
  }

  async function toggleTenantStatus(tenant) {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active'
    try {
      await api.patch(`/admin/tenants/${tenant.id}`, { status: newStatus })
      toast.success(`Tenant ${newStatus === 'active' ? 'aktiviert' : 'suspendiert'}`)
      refetchTenants()
    } catch (err) { toast.error(err.message) }
  }

  const TABS = [
    { key: 'tenants', label: 'Tenants',  icon: Building2 },
    { key: 'users',   label: 'Nutzer',   icon: Users },
    { key: 'audit',   label: 'Audit Log',icon: Shield },
    { key: 'monitor', label: 'Monitor',  icon: Activity },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={22} className="text-teal-600" />
        <h1 className="text-xl font-bold text-slate-800">Admin-Panel</h1>
        <div className="ml-auto">
          <Btn variant="success" size="sm" onClick={runBilling} disabled={billingLoading}>
            💳 {billingLoading ? 'Läuft…' : 'Billing ausführen'}
          </Btn>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Tenants */}
      {tab === 'tenants' && (
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold text-slate-700 mb-3">Tenant erstellen</h2>
            <form onSubmit={createTenant} className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Name</label>
                <input required value={newTenant.name} onChange={e => setNewTenant(t => ({ ...t, name: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Reisebüro GmbH" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">E-Mail</label>
                <input required type="email" value={newTenant.email} onChange={e => setNewTenant(t => ({ ...t, email: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="admin@reisebuero.de" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Aufschlag %</label>
                <input type="number" min="0" max="100" value={newTenant.markup_percent}
                  onChange={e => setNewTenant(t => ({ ...t, markup_percent: +e.target.value }))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <Btn type="submit">Erstellen</Btn>
            </form>
          </Card>
          <div className="space-y-2">
            {tenants?.results?.map(t => (
              <Card key={t.id}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{t.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{t.status}</span>
                    </div>
                    <p className="text-xs text-slate-500">{t.email} · {t.id} · {fmtDt(t.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="number" min="0" max="100"
                      value={markupEdit[t.id] ?? t.markup_percent}
                      onChange={e => setMarkupEdit(m => ({ ...m, [t.id]: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-20" />
                    <span className="text-sm text-slate-500">%</span>
                    {markupEdit[t.id] != null && (
                      <Btn size="sm" onClick={() => saveMarkup(t.id)}>Speichern</Btn>
                    )}
                    <Btn
                      size="sm"
                      variant={t.status === 'active' ? 'danger' : 'success'}
                      onClick={() => toggleTenantStatus(t)}
                    >
                      {t.status === 'active' ? '🔒 Suspendieren' : '✓ Aktivieren'}
                    </Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Btn variant="secondary" size="sm" onClick={refetchUsers}><RefreshCw size={13} /></Btn>
          </div>
          {users?.results?.map(u => (
            <Card key={u.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{u.email}</p>
                  <p className="text-xs text-slate-500">{u.role} · Tenant: {u.tenant_id}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {u.is_active ? 'aktiv' : 'inaktiv'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Audit */}
      {tab === 'audit' && (
        <div className="space-y-2">
          {audit?.results?.map((a, i) => (
            <Card key={i} className="text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{a.action}</span>
                  <span className="text-slate-500 ml-2 text-xs">{a.user_email}</span>
                  {a.booking_id && <span className="text-slate-500 ml-2 text-xs">· {a.booking_id}</span>}
                </div>
                <span className="text-xs text-slate-400 shrink-0">{fmtDt(a.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Monitor */}
      {tab === 'monitor' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Live-Update alle 5 Sekunden</p>
          {events?.results?.map((e, i) => (
            <Card key={i} className="text-sm">
              <div className="flex justify-between">
                <span className="text-slate-700"><span className="font-mono text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mr-2">{e.type}</span>{e.message}</span>
                <span className="text-xs text-slate-400 shrink-0">{fmtDt(e.created_at)}</span>
              </div>
            </Card>
          ))}
          {!events?.results?.length && <Card><p className="text-slate-500 text-sm">Keine Events</p></Card>}
        </div>
      )}
    </div>
  )
}
