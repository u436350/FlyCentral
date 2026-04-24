import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Package, Plus, Hotel, Plane, ArrowRight, CheckCircle,
  XCircle, Pencil, Trash2, X, Save, Tag, Users
} from 'lucide-react'

const api = (path, opts) => axios({ url: `/api${path}`, ...opts }).then(r => r.data)

const EMPTY = {
  name: '', description: '', flight_id: '', hotel_name: '', hotel_stars: 3,
  hotel_nights: 0, includes_transfer: false, base_price: '', destination: '', origin: '', max_pax: 20,
}

function StarRating({ n }) {
  return <span className="text-amber-400">{'★'.repeat(n || 0)}{'☆'.repeat(5 - (n || 0))}</span>
}

function PackageForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: () => {
      if (initial?.id) return api(`/packages/${initial.id}`, { method: 'PATCH', data: form })
      return api('/packages', { method: 'POST', data: form })
    },
    onSuccess: (data) => {
      qc.invalidateQueries(['packages'])
      toast.success(initial?.id ? '✅ Paket aktualisiert' : '✅ Paket erstellt')
      onSaved(data)
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Fehler'),
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold">{initial?.id ? 'Paket bearbeiten' : 'Neues Reisepaket'}</h2>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Paketname *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="z.B. Türkei Familienpaket 7 Nächte" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Von (IATA) *</label>
              <input value={form.origin} onChange={e => set('origin', e.target.value.toUpperCase())}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                placeholder="BER" maxLength={3}/>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nach (IATA) *</label>
              <input value={form.destination} onChange={e => set('destination', e.target.value.toUpperCase())}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                placeholder="AYT" maxLength={3}/>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Flug-ID (optional)</label>
            <input value={form.flight_id} onChange={e => set('flight_id', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="FC-BER-AYT-001"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hotelname</label>
            <input value={form.hotel_name} onChange={e => set('hotel_name', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Hotel Meerblick"/>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sterne</label>
              <select value={form.hotel_stars} onChange={e => set('hotel_stars', parseInt(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nächte</label>
              <input type="number" min="0" value={form.hotel_nights} onChange={e => set('hotel_nights', parseInt(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max. Pax</label>
              <input type="number" min="1" value={form.max_pax} onChange={e => set('max_pax', parseInt(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Basispreis pro Person (€) *</label>
            <input type="number" min="0" step="0.01" value={form.base_price} onChange={e => set('base_price', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="799.00"/>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.includes_transfer} onChange={e => set('includes_transfer', e.target.checked)}
              className="w-4 h-4 text-blue-600"/>
            <span>Transfer inbegriffen (Flughafen ↔ Hotel)</span>
          </label>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Beschreibung</label>
            <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Was ist alles enthalten?"/>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => save.mutate()} disabled={save.isLoading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={16}/> {save.isLoading ? 'Speichern...' : 'Speichern'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

export default function PackagesPage() {
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => api('/packages'),
  })

  const del = useMutation({
    mutationFn: (id) => api(`/packages/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries(['packages']); toast.success('Paket gelöscht') },
    onError: (e) => toast.error(e.response?.data?.error || 'Fehler'),
  })

  const toggle = useMutation({
    mutationFn: ({ id, val }) => api(`/packages/${id}`, { method: 'PATCH', data: { is_active: val } }),
    onSuccess: () => qc.invalidateQueries(['packages']),
  })

  const pkgs = data?.results || []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package size={28} className="text-blue-600"/>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reisepakete</h1>
            <p className="text-sm text-gray-500">{pkgs.length} Pakete — Flug + Hotel + Transfer</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow">
          <Plus size={18}/> Neues Paket
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Lade Pakete…</div>
      ) : pkgs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30"/>
          <p>Noch keine Reisepakete.</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-blue-600 underline text-sm">
            Erstes Paket erstellen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pkgs.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl shadow border overflow-hidden flex flex-col ${!p.is_active ? 'opacity-60' : ''}`}>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg leading-tight">{p.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${p.is_active ? 'bg-white/20' : 'bg-red-400/50'}`}>
                    {p.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-blue-100 text-sm">
                  <Plane size={14}/>
                  <span className="font-mono">{p.origin}</span>
                  <ArrowRight size={12}/>
                  <span className="font-mono">{p.destination}</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex flex-col gap-3 flex-1">
                {p.hotel_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Hotel size={16} className="text-gray-400"/>
                    <span className="font-medium">{p.hotel_name}</span>
                    <StarRating n={p.hotel_stars}/>
                    <span className="text-gray-400">· {p.hotel_nights}N</span>
                  </div>
                )}
                {p.includes_transfer && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle size={14}/> Transfer inbegriffen
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users size={14}/> Max. {p.max_pax} Personen
                </div>
                {p.description && <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>}

                {/* Preis */}
                <div className="mt-auto pt-3 border-t flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Basispreis</p>
                    <p className="text-gray-500 line-through text-sm">{parseFloat(p.base_price).toFixed(2)} €</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Endpreis (+{p.markup_percent}% Aufschlag)</p>
                    <p className="text-2xl font-bold text-blue-600">{p.final_price?.toFixed(2)} €</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t px-4 py-3 flex gap-2">
                <button onClick={() => setEditing(p)}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">
                  <Pencil size={14}/> Bearbeiten
                </button>
                <button onClick={() => toggle.mutate({ id: p.id, val: !p.is_active })}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg ${p.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}>
                  {p.is_active ? <><XCircle size={14}/> Deaktivieren</> : <><CheckCircle size={14}/> Aktivieren</>}
                </button>
                <button onClick={() => { if (window.confirm('Paket löschen?')) del.mutate(p.id) }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg ml-auto">
                  <Trash2 size={14}/> Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <PackageForm initial={null} onClose={() => setShowNew(false)} onSaved={() => setShowNew(false)}/>}
      {editing  && <PackageForm initial={editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)}/>}
    </div>
  )
}
