import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Percent, Euro, CheckCircle, Clock, Plus, X, Save, Tag, CreditCard } from 'lucide-react'

const api = (path, opts) => axios({ url: `/api${path}`, ...opts }).then(r => r.data)

// ── Provisionen ───────────────────────────────────────────────────────────────
function CommissionsTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => api('/commissions'),
  })

  const pay = useMutation({
    mutationFn: (id) => api(`/commissions/${id}/pay`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries(['commissions']); toast.success('Provision ausgezahlt ✅') },
    onError: (e) => toast.error(e.response?.data?.error || 'Fehler'),
  })

  if (isLoading) return <div className="text-center py-12 text-gray-400">Lade Provisionen…</div>

  const rows  = data?.results || []
  const total = parseFloat(data?.total_commissions || 0)
  const pend  = parseFloat(data?.pending_commissions || 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Statistiken */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-xs text-blue-500 mb-1">Gesamt Provisionen</p>
          <p className="text-2xl font-bold text-blue-700">{total.toFixed(2)} €</p>
        </div>
        <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-100">
          <p className="text-xs text-yellow-500 mb-1">Ausstehend</p>
          <p className="text-2xl font-bold text-yellow-700">{pend.toFixed(2)} €</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <p className="text-xs text-green-500 mb-1">Ausgezahlt</p>
          <p className="text-2xl font-bold text-green-700">{(total - pend).toFixed(2)} €</p>
        </div>
      </div>

      {/* Tabelle */}
      {rows.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Euro size={40} className="mx-auto mb-3 opacity-30"/>
          <p>Noch keine Provisionen. Provisionen werden automatisch bei Ticketausstellung erzeugt.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Agent</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Buchung</th>
                <th className="text-right px-4 py-3">Basis</th>
                <th className="text-right px-4 py-3">Rate</th>
                <th className="text-right px-4 py-3">Provision</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.agent_email}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">{r.booking_id}</td>
                  <td className="px-4 py-3 text-right">{parseFloat(r.base_amount).toFixed(2)} €</td>
                  <td className="px-4 py-3 text-right text-gray-500">{r.commission_rate}%</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{parseFloat(r.commission_amount).toFixed(2)} €</td>
                  <td className="px-4 py-3 text-center">
                    {r.status === 'paid' ? (
                      <span className="flex items-center justify-center gap-1 text-green-600 text-xs">
                        <CheckCircle size={14}/> Ausgezahlt
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-yellow-600 text-xs">
                        <Clock size={14}/> Ausstehend
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <button
                        onClick={() => pay.mutate(r.id)}
                        disabled={pay.isLoading}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                        Auszahlen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Rabattcodes ────────────────────────────────────────────────────────────────
function DiscountsTab() {
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ code: '', type: 'percent', value: '', max_uses: 100, valid_until: '' })
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['discounts'],
    queryFn: () => api('/discounts'),
  })

  const create = useMutation({
    mutationFn: () => api('/discounts', { method: 'POST', data: form }),
    onSuccess: () => { qc.invalidateQueries(['discounts']); toast.success('Code erstellt ✅'); setShowNew(false) },
    onError: (e) => toast.error(e.response?.data?.error || 'Fehler'),
  })

  const deactivate = useMutation({
    mutationFn: (id) => api(`/discounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries(['discounts']); toast.success('Code deaktiviert') },
  })

  const codes = data?.results || []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow">
          <Plus size={16}/> Neuer Rabattcode
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Lade…</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Tag size={40} className="mx-auto mb-3 opacity-30"/>
          <p>Noch keine Rabattcodes.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Typ</th>
                <th className="text-right px-4 py-3">Wert</th>
                <th className="text-right px-4 py-3">Nutzungen</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Gültig bis</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-blue-700">{c.code}</td>
                  <td className="px-4 py-3">{c.type === 'percent' ? <><Percent size={14} className="inline text-gray-400 mr-1"/>Prozent</> : <><CreditCard size={14} className="inline text-gray-400 mr-1"/>Fest</>}</td>
                  <td className="px-4 py-3 text-right font-bold">{c.type === 'percent' ? `${c.value}%` : `${parseFloat(c.value).toFixed(2)} €`}</td>
                  <td className="px-4 py-3 text-right">{c.used_count} / {c.max_uses}</td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{c.valid_until ? new Date(c.valid_until).toLocaleDateString('de-DE') : '∞'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {c.is_active ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.is_active && (
                      <button onClick={() => deactivate.mutate(c.id)}
                        className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded">
                        Deaktivieren
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Neuer Code Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Neuer Rabattcode</h2>
              <button onClick={() => setShowNew(false)}><X size={20}/></button>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Code *</label>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="w-full border rounded-lg px-3 py-2 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="SOMMER25"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Typ</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="percent">Prozent (%)</option>
                    <option value="fixed">Festbetrag (€)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Wert *</label>
                  <input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={form.type === 'percent' ? '10' : '50.00'}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Max. Nutzungen</label>
                  <input type="number" min="1" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: parseInt(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Gültig bis</label>
                  <input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => create.mutate()} disabled={create.isLoading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={16}/> Erstellen
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hauptseite ─────────────────────────────────────────────────────────────────
export default function CommissionsPage() {
  const [tab, setTab] = useState('commissions')
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Euro size={28} className="text-blue-600"/>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provisionen & Rabattcodes</h1>
          <p className="text-sm text-gray-500">Agenten-Provisionen und Aktionscodes verwalten</p>
        </div>
      </div>

      {/* Tab-Navigation */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setTab('commissions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'commissions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          💰 Provisionen
        </button>
        <button
          onClick={() => setTab('discounts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'discounts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          🏷️ Rabattcodes
        </button>
      </div>

      {tab === 'commissions' ? <CommissionsTab/> : <DiscountsTab/>}
    </div>
  )
}
