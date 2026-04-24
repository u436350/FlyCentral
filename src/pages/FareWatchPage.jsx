import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { Bell, Trash2, Zap } from 'lucide-react'

export default function FareWatchPage() {
  const [form, setForm] = useState({ origin: '', destination: '', max_price: '', departure_date: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['fare-watch'],
    queryFn:  () => api.get('/fare-watch').then(r => r.data),
  })

  const [checking, setChecking] = useState(false)
  async function checkPrices() {
    setChecking(true)
    try {
      const { data: res } = await api.post('/fare-watch/check')
      if (res.triggered > 0) {
        toast.success(`${res.triggered} Preisalarm(e) ausgelöst! Prüfe Benachrichtigungen.`)
      } else {
        toast('Keine passenden Flüge gefunden – kein Alarm ausgelöst', { icon: '🔍' })
      }
      refetch()
    } catch (err) { toast.error(err.message) }
    finally { setChecking(false) }
  }

  async function create(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/fare-watch', {
        ...form,
        max_price: parseFloat(form.max_price),
      })
      toast.success('Preisalarm gespeichert!')
      setForm({ origin: '', destination: '', max_price: '', departure_date: '' })
      refetch()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function remove(id) {
    try {
      await api.delete(`/fare-watch/${id}`)
      toast.success('Alarm gelöscht')
      refetch()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell size={22} className="text-teal-600" />
        <h1 className="text-xl font-bold text-slate-800">Preisalarme</h1>
      </div>

      <Card>
        <h2 className="font-semibold text-slate-700 mb-3">Neuen Alarm einrichten</h2>
        <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Von</label>
            <input required value={form.origin} onChange={set('origin')}
              onInput={e => e.target.value = e.target.value.toUpperCase()}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="FRA" maxLength={3} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nach</label>
            <input required value={form.destination} onChange={set('destination')}
              onInput={e => e.target.value = e.target.value.toUpperCase()}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="JFK" maxLength={3} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Max. Preis €</label>
            <input required type="number" min="1" value={form.max_price} onChange={set('max_price')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reisedatum</label>
            <input type="date" value={form.departure_date} onChange={set('departure_date')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="col-span-2 md:col-span-4">
            <Btn type="submit" disabled={saving}>{saving ? 'Speichern…' : 'Alarm erstellen'}</Btn>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-slate-700">Meine Alarme ({data?.results?.length ?? 0})</h2>
          <Btn onClick={checkPrices} disabled={checking} variant="secondary" size="sm">
            <Zap size={14} /> {checking ? 'Prüfe Preise…' : 'Preise jetzt prüfen'}
          </Btn>
        </div>
        {isLoading && <p className="text-slate-500 text-sm">Lade…</p>}
        {!isLoading && !data?.results?.length && (
          <Card><p className="text-slate-500 text-sm">Noch keine Alarme</p></Card>
        )}
        {data?.results?.map(w => (
          <Card key={w.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{w.origin} → {w.destination}</p>
                <p className="text-sm text-slate-500">
                  Max. {w.max_price} €{w.departure_date ? ` · Datum: ${w.departure_date}` : ''}
                </p>
                <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                  w.is_active ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {w.is_active ? '🟢 aktiv' : '⚡ ausgelöst'}
                </span>
              </div>
              <Btn variant="danger" size="sm" onClick={() => remove(w.id)}>
                <Trash2 size={13} /> Löschen
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
