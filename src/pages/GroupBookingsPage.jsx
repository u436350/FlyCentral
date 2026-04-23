import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Users, Plus, UserPlus, Trash2, X, Save, Badge } from 'lucide-react'

const api = (path, opts) => axios({ url: `/api${path}`, ...opts }).then(r => r.data)

function GroupForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ group_name: '', flight_id: '', base_price: '', discount_percent: 0, max_passengers: 10, notes: '', ...initial })
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: () => {
      if (initial?.id) return api(`/group-bookings/${initial.id}`, { method: 'PATCH', data: form })
      return api('/group-bookings', { method: 'POST', data: form })
    },
    onSuccess: () => { qc.invalidateQueries(['group-bookings']); toast.success(initial?.id ? 'Aktualisiert' : 'Gruppe erstellt'); onSaved() },
    onError: (e) => toast.error(e.response?.data?.error),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold">{initial?.id ? 'Gruppe bearbeiten' : 'Neue Gruppenbuchung'}</h2>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <input value={form.group_name} onChange={e => setForm(p => ({ ...p, group_name: e.target.value }))}
            className="border rounded-lg px-3 py-2" placeholder="Gruppenname *"/>
          <input value={form.flight_id} onChange={e => setForm(p => ({ ...p, flight_id: e.target.value }))}
            className="border rounded-lg px-3 py-2" placeholder="Flug-ID (optional)"/>
          <input type="number" value={form.base_price} onChange={e => setForm(p => ({ ...p, base_price: e.target.value }))}
            className="border rounded-lg px-3 py-2" placeholder="Basispreis pro Person €"/>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="0" max="50" value={form.discount_percent} onChange={e => setForm(p => ({ ...p, discount_percent: parseInt(e.target.value) }))}
              className="border rounded-lg px-3 py-2" placeholder="Rabatt %"/>
            <input type="number" min="1" value={form.max_passengers} onChange={e => setForm(p => ({ ...p, max_passengers: parseInt(e.target.value) }))}
              className="border rounded-lg px-3 py-2" placeholder="Max. Personen"/>
          </div>
          <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="border rounded-lg px-3 py-2" placeholder="Notizen"/>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => save.mutate()} disabled={save.isLoading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {save.isLoading ? 'Speichern...' : 'Speichern'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

function PassengerModal({ groupId, onClose }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', passport_number: '' })
  const qc = useQueryClient()

  const add = useMutation({
    mutationFn: () => api(`/group-bookings/${groupId}/passengers`, { method: 'POST', data: form }),
    onSuccess: () => { qc.invalidateQueries(['group-booking', groupId]); toast.success('Passagier hinzugefügt'); setForm({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', passport_number: '' }) },
    onError: (e) => toast.error(e.response?.data?.error),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex justify-between mb-4"><h2 className="text-lg font-bold">Passagier hinzufügen</h2><button onClick={onClose}><X size={20}/></button></div>
        <div className="flex flex-col gap-2 text-sm">
          <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} className="border rounded-lg px-3 py-2" placeholder="Vorname *"/>
          <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} className="border rounded-lg px-3 py-2" placeholder="Nachname *"/>
          <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="border rounded-lg px-3 py-2" placeholder="E-Mail"/>
          <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="border rounded-lg px-3 py-2" placeholder="Telefon"/>
          <input type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} className="border rounded-lg px-3 py-2"/>
          <input value={form.passport_number} onChange={e => setForm(p => ({ ...p, passport_number: e.target.value }))} className="border rounded-lg px-3 py-2" placeholder="Reisepass-Nr."/>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => add.mutate()} disabled={add.isLoading} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {add.isLoading ? 'Hinzufügen...' : 'Hinzufügen'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

export default function GroupBookingsPage() {
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [showPassengerForm, setShowPassengerForm] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['group-bookings'],
    queryFn: () => api('/group-bookings'),
  })

  const { data: detail } = useQuery({
    queryKey: ['group-booking', selectedGroupId],
    queryFn: () => api(`/group-bookings/${selectedGroupId}`),
    enabled: !!selectedGroupId,
  })

  const del = useMutation({
    mutationFn: (id) => api(`/group-bookings/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries(['group-bookings']); toast.success('Gelöscht') },
  })

  const delPax = useMutation({
    mutationFn: (paxId) => api(`/group-bookings/passengers/${paxId}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries(['group-booking', selectedGroupId]); toast.success('Passagier entfernt') },
  })

  const groups = data?.results || []
  const group = detail

  if (selectedGroupId && group) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={() => setSelectedGroupId(null)} className="mb-4 text-blue-600 underline">&larr; Zurück</button>
        <div className="bg-white rounded-2xl shadow border p-6">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h1 className="text-2xl font-bold">{group.group_name}</h1>
              <p className="text-gray-500">{group.flight_id || 'Kein Flug'} · {group.current_passengers}/{group.max_passengers} Personen</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">{parseFloat(group.final_price).toFixed(2)} €</p>
              <p className="text-sm text-gray-500">{group.discount_percent}% Rabatt</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-gray-500">Status</p><p className="font-bold text-blue-700">{group.status}</p></div>
            <div className="bg-green-50 rounded-lg p-3"><p className="text-xs text-gray-500">Zahlung</p><p className="font-bold text-green-700">{group.payment_status}</p></div>
            <div className="bg-amber-50 rounded-lg p-3"><p className="text-xs text-gray-500">Auslastung</p><p className="font-bold text-amber-700">{Math.round(group.current_passengers / group.max_passengers * 100)}%</p></div>
          </div>

          {/* Passagiere */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-lg">Passagiere ({group.passengers?.length || 0})</h2>
              {group.current_passengers < group.max_passengers && (
                <button onClick={() => setShowPassengerForm(true)} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700">
                  <UserPlus size={16}/> Passagier
                </button>
              )}
            </div>
            {group.passengers?.length > 0 ? (
              <div className="space-y-2">
                {group.passengers.map((p, i) => (
                  <div key={p.id} className="border rounded-lg p-3 flex justify-between items-center text-sm">
                    <div><p className="font-medium">{i+1}. {p.first_name} {p.last_name}</p><p className="text-gray-500">{p.email}</p></div>
                    <button onClick={() => delPax.mutate(p.id)} className="text-red-500 hover:bg-red-50 p-2"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-500 text-sm">Noch keine Passagiere</p>}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => { setSelectedGroupId(null); setEditing(group) }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Bearbeiten</button>
            <button onClick={() => del.mutate(group.id)} className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">Löschen</button>
          </div>
        </div>
        {showPassengerForm && <PassengerModal groupId={selectedGroupId} onClose={() => setShowPassengerForm(false)}/>}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={28} className="text-blue-600"/>
          <div>
            <h1 className="text-2xl font-bold">Gruppenbuchungen</h1>
            <p className="text-sm text-gray-500">{groups.length} Gruppen aktiv</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={18}/> Neue Gruppe
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Lade…</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Users size={48} className="mx-auto mb-3 opacity-30"/><p>Noch keine Gruppen</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(g => (
            <div key={g.id} onClick={() => setSelectedGroupId(g.id)} className="bg-white rounded-2xl shadow border p-5 cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-gray-800">{g.group_name}</h3>
                <Badge size={16} className="text-amber-600"/>
              </div>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p>✈️ {g.flight_id || '–'}</p>
                <p>👥 {g.current_passengers}/{g.max_passengers} Personen · {Math.round(g.current_passengers / g.max_passengers * 100)}%</p>
                <p>💶 {parseFloat(g.final_price).toFixed(2)} € (−{g.discount_percent}%)</p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full ${g.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : g.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                  {g.status}
                </span>
                <span className={`px-2 py-1 rounded-full ${g.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {g.payment_status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <GroupForm initial={null} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); }}/>}
      {editing && <GroupForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setSelectedGroupId(null) }}/>}
    </div>
  )
}
