import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Users, Search, Plus, Phone, Mail, Globe, Star,
  ChevronRight, X, Save, Trash2, Award
} from 'lucide-react'

const api = (path, opts) => axios({ url: `/api${path}`, ...opts }).then(r => r.data)

// ── Formular-Felder ──────────────────────────────────────────────────────────
const FIELDS = [
  { key: 'first_name',       label: 'Vorname *',          type: 'text' },
  { key: 'last_name',        label: 'Nachname *',         type: 'text' },
  { key: 'email',            label: 'E-Mail',             type: 'email' },
  { key: 'phone',            label: 'Telefon',            type: 'tel' },
  { key: 'date_of_birth',    label: 'Geburtsdatum',       type: 'date' },
  { key: 'nationality',      label: 'Staatsangehörigkeit (ISO)', type: 'text', placeholder:'DE' },
  { key: 'passport_number',  label: 'Reisepass-Nr.',      type: 'text' },
  { key: 'passport_expiry',  label: 'Reisepass gültig bis', type: 'date' },
  { key: 'notes',            label: 'Notizen',            type: 'textarea' },
]

const EMPTY = Object.fromEntries(FIELDS.map(f => [f.key, '']))

function nationalityFlag(code) {
  if (!code || code.length !== 2) return '🌍'
  const cp = [...code.toUpperCase()].map(c => 0x1F1E0 - 0x41 + c.charCodeAt(0))
  return String.fromCodePoint(...cp)
}

// ── Kundendetail-Panel ───────────────────────────────────────────────────────
function CustomerDetail({ customer, onClose, onEdit, onDelete }) {
  const { data: detail } = useQuery({
    queryKey: ['customer', customer.id],
    queryFn: () => api(`/customers/${customer.id}`),
  })
  const c = detail?.customer || customer

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-end z-50">
      <div className="bg-white h-full w-full max-w-xl overflow-y-auto p-6 shadow-2xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            {nationalityFlag(c.nationality)} {c.first_name} {c.last_name}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Treuepunkte */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Award size={32} className="text-amber-500" />
          <div>
            <p className="text-sm text-amber-700 font-medium">Treuepunkte</p>
            <p className="text-3xl font-bold text-amber-600">{c.loyalty_points ?? 0}</p>
          </div>
        </div>

        {/* Stammdaten */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {c.email    && <div className="col-span-2 flex gap-2"><Mail size={16} className="text-gray-400 mt-0.5"/><span>{c.email}</span></div>}
          {c.phone    && <div className="col-span-2 flex gap-2"><Phone size={16} className="text-gray-400 mt-0.5"/><span>{c.phone}</span></div>}
          {c.nationality && <div><span className="text-gray-500">Nationalität</span><br/><strong>{c.nationality}</strong></div>}
          {c.date_of_birth && <div><span className="text-gray-500">Geburtstag</span><br/><strong>{c.date_of_birth?.slice(0,10)}</strong></div>}
          {c.passport_number && <div><span className="text-gray-500">Reisepass</span><br/><strong>{c.passport_number}</strong></div>}
          {c.passport_expiry && <div><span className="text-gray-500">Gültig bis</span><br/><strong>{c.passport_expiry?.slice(0,10)}</strong></div>}
          {c.notes && <div className="col-span-2"><span className="text-gray-500">Notizen</span><br/><p className="text-gray-700 mt-1 whitespace-pre-line">{c.notes}</p></div>}
        </div>

        {/* Reisehistorie */}
        {detail?.booking_history?.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Reisehistorie ({detail.booking_history.length})</h3>
            <div className="flex flex-col gap-2">
              {detail.booking_history.map(b => (
                <div key={b.id} className="border rounded-lg p-3 text-sm flex justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{b.flight_id}</p>
                    <p className="text-gray-500">{new Date(b.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{parseFloat(b.paid_price || 0).toFixed(2)} €</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {b.payment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-auto">
          <button onClick={() => onEdit(c)} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
            <Save size={16}/> Bearbeiten
          </button>
          <button onClick={() => onDelete(c)} className="flex items-center justify-center gap-2 bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200">
            <Trash2 size={16}/>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Kunden-Formular ──────────────────────────────────────────────────────────
function CustomerForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: () => {
      if (initial?.id) {
        return api(`/customers/${initial.id}`, { method: 'PUT', data: form })
      }
      return api('/customers', { method: 'POST', data: form })
    },
    onSuccess: (data) => {
      qc.invalidateQueries(['customers'])
      qc.invalidateQueries(['customer', initial?.id])
      toast.success(initial?.id ? '✅ Gespeichert' : '✅ Kunde angelegt')
      onSaved(data)
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Fehler'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{initial?.id ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h2>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="flex flex-col gap-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={form[f.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={f.placeholder || ''}
                />
              ) : (
                <input
                  type={f.type}
                  value={form[f.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={f.placeholder || ''}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={() => save.mutate()}
            disabled={save.isLoading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={16}/> {save.isLoading ? 'Speichern...' : 'Speichern'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

// ── Hauptseite ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [editCustomer, setEditCustomer] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['customers', q],
    queryFn: () => api(`/customers?q=${encodeURIComponent(q)}`),
    keepPreviousData: true,
  })

  const del = useMutation({
    mutationFn: (id) => api(`/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries(['customers']); setSelected(null); toast.success('Kunde gelöscht') },
    onError: (e) => toast.error(e.response?.data?.error || 'Fehler'),
  })

  const handleDelete = (c) => {
    if (window.confirm(`${c.first_name} ${c.last_name} wirklich löschen?`)) del.mutate(c.id)
  }

  const customers = data?.results || []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={28} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kundenverwaltung (CRM)</h1>
            <p className="text-sm text-gray-500">{data?.count ?? '–'} Kunden</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow"
        >
          <Plus size={18}/> Neuer Kunde
        </button>
      </div>

      {/* Suche */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Name, E-Mail oder Telefon suchen…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {/* Kundenliste */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Lade Kunden…</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>Keine Kunden gefunden.</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-blue-600 underline text-sm">Ersten Kunden anlegen</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Kunde</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Kontakt</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Land</th>
                <th className="text-right px-4 py-3">Punkte</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{c.first_name} {c.last_name}</p>
                        <p className="text-gray-400 text-xs">{c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                    <div className="flex flex-col">
                      {c.email && <span className="flex items-center gap-1"><Mail size={12}/>{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone size={12}/>{c.phone}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="flex items-center gap-1">
                      <Globe size={14} className="text-gray-400"/>
                      {c.nationality || '–'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="flex items-center justify-end gap-1 text-amber-600 font-semibold">
                      <Star size={14}/> {c.loyalty_points || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    <ChevronRight size={16}/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {selected && (
        <CustomerDetail
          customer={selected}
          onClose={() => setSelected(null)}
          onEdit={(c) => { setEditCustomer(c); setSelected(null) }}
          onDelete={(c) => handleDelete(c)}
        />
      )}
      {editCustomer && (
        <CustomerForm
          initial={editCustomer}
          onClose={() => setEditCustomer(null)}
          onSaved={() => setEditCustomer(null)}
        />
      )}
      {showNew && (
        <CustomerForm
          initial={null}
          onClose={() => setShowNew(false)}
          onSaved={() => setShowNew(false)}
        />
      )}
    </div>
  )
}
