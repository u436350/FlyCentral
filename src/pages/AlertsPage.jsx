import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { RefreshCw } from 'lucide-react'

function fmtDt(s) {
  return s ? new Date(s).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–'
}

export default function AlertsPage() {
  const [webhook, setWebhook] = useState({ booking_id: '', event: 'flight_cancelled', message: '' })
  const [wLoading, setWLoading] = useState(false)
  const setW = k => e => setWebhook(w => ({ ...w, [k]: e.target.value }))

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30_000,
  })

  async function testWebhook(e) {
    e.preventDefault()
    setWLoading(true)
    try {
      await api.post('/webhook/airline', webhook)
      toast.success('Webhook-Simulation gesendet')
      refetch()
    } catch (err) { toast.error(err.message) }
    finally { setWLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">🔔 Alarme & Benachrichtigungen</h1>
        <Btn variant="secondary" size="sm" onClick={refetch}><RefreshCw size={14} /> Aktualisieren</Btn>
      </div>

      {/* Webhook Test */}
      <Card>
        <h2 className="font-semibold text-slate-700 mb-3">Webhook simulieren</h2>
        <form onSubmit={testWebhook} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Buchungs-ID</label>
            <input value={webhook.booking_id} onChange={setW('booking_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="BK-XXXX" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Event-Typ</label>
            <select value={webhook.event} onChange={setW('event')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="flight_cancelled">flight_cancelled</option>
              <option value="flight_delayed">flight_delayed</option>
              <option value="schedule_change">schedule_change</option>
              <option value="price_alert">price_alert</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nachricht</label>
            <input value={webhook.message} onChange={setW('message')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Optionale Nachricht" />
          </div>
          <div className="md:col-span-3">
            <Btn type="submit" disabled={wLoading}>{wLoading ? 'Sende…' : 'Webhook senden'}</Btn>
          </div>
        </form>
      </Card>

      {/* Notifications List */}
      <div className="space-y-3">
        <h2 className="font-semibold text-slate-700">Benachrichtigungen ({data?.results?.length ?? 0})</h2>
        {isLoading && <p className="text-slate-500 text-sm">Lade…</p>}
        {!isLoading && !data?.results?.length && (
          <Card><p className="text-slate-500 text-sm">Keine Benachrichtigungen</p></Card>
        )}
        {data?.results?.map(n => (
          <Card key={n.id} className={`border-l-4 ${n.read_at ? 'border-slate-200' : 'border-teal-500'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-800">{n.title}</p>
                <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{fmtDt(n.created_at)} · Typ: {n.type}</p>
              </div>
              {!n.read_at && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full shrink-0">Neu</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
