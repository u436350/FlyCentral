import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { RefreshCw, MessageSquare, Printer, Search, Download, CreditCard } from 'lucide-react'

function fmtDt(s) {
  if (!s) return '–'
  return new Date(s).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

const STATUS_COLOR = {
  reserved:  'bg-yellow-100 text-yellow-700',
  ticketed:  'bg-green-100  text-green-700',
  cancelled: 'bg-red-100    text-red-700',
}
const PAY_COLOR = {
  paid:   'bg-green-100 text-green-700',
  unpaid: 'bg-orange-100 text-orange-700',
}

function NotesModal({ bookingId, onClose }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  const { data, refetch } = useQuery({
    queryKey: ['notes', bookingId],
    queryFn:  () => api.get(`/bookings/${bookingId}/notes`).then(r => r.data),
  })

  async function saveNote() {
    if (!note.trim()) return
    setSaving(true)
    try {
      await api.post(`/bookings/${bookingId}/notes`, { note: note.trim() })
      setNote('')
      refetch()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">📝 Notizen – {bookingId}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
          {!data?.notes?.length && <p className="text-sm text-slate-400">Noch keine Notizen</p>}
          {data?.notes?.map(n => (
            <div key={n.id} className="border-l-4 border-teal-500 pl-3 py-1 bg-teal-50 rounded-r-lg">
              <p className="text-xs text-slate-500">{n.user_email} · {fmtDt(n.created_at)}</p>
              <p className="text-sm text-slate-800">{n.note}</p>
            </div>
          ))}
        </div>
        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="Neue Notiz (max. 500 Zeichen)…" maxLength={500} />
        <div className="flex gap-2">
          <Btn onClick={saveNote} disabled={saving}>{saving ? 'Speichern…' : 'Notiz speichern'}</Btn>
          <Btn variant="secondary" onClick={onClose}>Schließen</Btn>
        </div>
      </Card>
    </div>
  )
}

function ActionModal({ booking, action, onClose, onDone }) {
  const [form, setForm] = useState({ new_date: '', customer_email: '', extras: '', corrected_name: '', passenger_index: 0 })
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    try {
      if (action === 'checkout') {
        await api.post(`/bookings/${booking.id}/checkout`)
        const { data } = await api.post(`/bookings/${booking.id}/pay`, { customer_email: form.customer_email })
        toast.success(`✅ Bezahlt · Ticket: ${data.ticket_number}`)
      } else if (action === 'rebook') {
        await api.post(`/bookings/${booking.id}/rebook`, { new_date: form.new_date })
        toast.success('Umbuchung gespeichert')
      } else if (action === 'extras') {
        await api.post(`/bookings/${booking.id}/extras`, { extras: form.extras.split(',').map(s=>s.trim()) })
        toast.success('Extras hinzugefügt')
      } else if (action === 'name') {
        await api.post(`/bookings/${booking.id}/name-correction`, { passenger_index: parseInt(form.passenger_index), corrected_name: form.corrected_name })
        toast.success('Name korrigiert')
      } else if (action === 'ticket') {
        await api.post(`/bookings/${booking.id}/ticket`, { customer_email: form.customer_email })
        toast.success('Ticket ausgestellt')
      }
      onDone()
      onClose()
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const content = {
    checkout: <>
      <label className="block text-sm font-medium mb-1">Kunden-E-Mail</label>
      <input type="email" value={form.customer_email} onChange={set('customer_email')} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="kunde@email.de" />
    </>,
    rebook: <>
      <label className="block text-sm font-medium mb-1">Neues Datum</label>
      <input type="date" value={form.new_date} onChange={set('new_date')} className="w-full border rounded-lg px-3 py-2 text-sm" />
    </>,
    extras: <>
      <label className="block text-sm font-medium mb-1">Extras (kommagetrennt)</label>
      <input value={form.extras} onChange={set('extras')} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Sitzwahl, Gepäck" />
    </>,
    name: <>
      <label className="block text-sm font-medium mb-1">Passagier-Index (0-basiert)</label>
      <input type="number" min="0" value={form.passenger_index} onChange={set('passenger_index')} className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
      <label className="block text-sm font-medium mb-1">Korrigierter Name</label>
      <input value={form.corrected_name} onChange={set('corrected_name')} className="w-full border rounded-lg px-3 py-2 text-sm" />
    </>,
    ticket: <>
      <label className="block text-sm font-medium mb-1">Kunden-E-Mail</label>
      <input type="email" value={form.customer_email} onChange={set('customer_email')} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="kunde@email.de" />
    </>,
  }[action]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg capitalize">{action} – {booking.id}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="mb-4">{content}</div>
        <div className="flex gap-2">
          <Btn onClick={submit} disabled={loading}>{loading ? 'Verarbeite…' : 'Bestätigen'}</Btn>
          <Btn variant="secondary" onClick={onClose}>Abbrechen</Btn>
        </div>
      </Card>
    </div>
  )
}

function TicketModal({ booking, onClose }) {
  const { t } = useTranslation()
  const names = Array.isArray(booking.passenger_names)
    ? booking.passenger_names
    : JSON.parse(booking.passenger_names || '[]')

  function print() { window.print() }

  async function downloadPdf() {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'landscape' })

      // Background
      doc.setFillColor(13, 148, 136)
      doc.rect(0, 0, 210, 40, 'F')

      // Title
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.text('FlyCentral – Boarding Pass', 10, 10)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text(`${booking.origin || '???'} → ${booking.destination || '???'}`, 10, 28)

      // Ticket number
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Ticket:', 160, 18)
      doc.setFont('courier', 'bold')
      doc.setFontSize(9)
      doc.text(booking.ticket_number || 'N/A', 160, 25)

      // Body
      doc.setTextColor(50, 50, 50)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)

      const lines = [
        ['Buchungs-ID:', booking.id],
        ['Flug-ID:',     booking.flight_id],
        ['Airline:',     booking.airline || '–'],
        ['Abflug:',      booking.departure_at ? new Date(booking.departure_at).toLocaleString('de-DE') : '–'],
        ['Preis:',       `${parseFloat(booking.paid_price).toFixed(2)} EUR`],
        ['Status:',      booking.status],
        ['Passagiere:',  names.join(', ')],
      ]

      let y = 52
      lines.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold')
        doc.text(label, 10, y)
        doc.setFont('helvetica', 'normal')
        doc.text(String(value), 55, y)
        y += 10
      })

      // Footer
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text('Dieses Ticket wurde automatisch von FlyCentral generiert.', 10, 135)
      doc.text(`Generiert: ${new Date().toLocaleString('de-DE')}`, 10, 140)

      doc.save(`ticket-${booking.id}.pdf`)
      toast.success('PDF heruntergeladen!')
    } catch (err) {
      toast.error('PDF-Fehler: ' + err.message)
    }
  }

  async function stripeCheckout() {
    try {
      const { data } = await api.post(`/stripe/checkout/${booking.id}`)
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        toast.error('Stripe nicht konfiguriert – nutze "Bezahlen" im Aktionsmenü')
      }
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md print:shadow-none print:rounded-none" id="ticket-print">
        {/* Ticket Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-500 rounded-t-2xl p-5 text-white print:rounded-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-100 text-xs">✈ FlyCentral – Boarding Pass</p>
              <p className="text-2xl font-black tracking-widest mt-1">
                {booking.origin || '???'} → {booking.destination || '???'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-teal-100">Ticketnummer</p>
              <p className="font-mono font-bold text-lg">{booking.ticket_number || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Dashed separator */}
        <div className="relative">
          <div className="absolute left-0 right-0 border-t-2 border-dashed border-slate-200"></div>
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-100 rounded-full"></div>
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-100 rounded-full"></div>
        </div>

        {/* Ticket Body */}
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Buchungs-ID</p>
              <p className="font-mono font-semibold text-slate-800">{booking.id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Flug</p>
              <p className="font-mono font-semibold text-slate-800">{booking.flight_id}</p>
            </div>
            {booking.airline && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Airline</p>
                <p className="font-semibold text-slate-800">{booking.airline}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Preis</p>
              <p className="font-bold text-teal-700">{parseFloat(booking.paid_price).toFixed(2)} €</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Passagiere</p>
            {names.map((n, i) => (
              <p key={i} className="font-semibold text-slate-800">{i + 1}. {n}</p>
            ))}
          </div>

          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">Status</p>
            <p className="text-sm font-bold text-green-600 uppercase tracking-wider">✓ Ticket ausgestellt</p>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2 flex-wrap">
          <Btn onClick={print} variant="secondary" size="sm">
            <Printer size={14} /> Drucken
          </Btn>
          <Btn onClick={downloadPdf} variant="outline" size="sm">
            <Download size={14} /> PDF
          </Btn>
          {booking.payment_status !== 'paid' && (
            <Btn onClick={stripeCheckout} variant="primary" size="sm">
              <CreditCard size={14} /> Stripe
            </Btn>
          )}
          <Btn onClick={onClose} variant="secondary" size="sm" className="ml-auto">Schließen</Btn>
        </div>
      </div>
    </div>
  )
}

export default function BookingsPage() {
  const qc = useQueryClient()
  const [notesFor, setNotesFor]   = useState(null)
  const [actionFor, setActionFor] = useState(null)
  const [ticketFor, setTicketFor] = useState(null)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [payFilter, setPayFilter] = useState('all')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bookings'],
    queryFn:  () => api.get('/bookings').then(r => r.data),
  })

  const filtered = useMemo(() => {
    let list = data?.results || []
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter)
    if (payFilter !== 'all')    list = list.filter(b => b.payment_status === payFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(b => {
        const names = Array.isArray(b.passenger_names) ? b.passenger_names : JSON.parse(b.passenger_names || '[]')
        return b.id.toLowerCase().includes(q)
          || b.flight_id.toLowerCase().includes(q)
          || (b.origin || '').toLowerCase().includes(q)
          || (b.destination || '').toLowerCase().includes(q)
          || names.some(n => n.toLowerCase().includes(q))
      })
    }
    return list
  }, [data, search, statusFilter, payFilter])

  async function cancelBooking(id) {
    if (!confirm('Wirklich stornieren? (85% Rückerstattung bei bezahlten Buchungen)')) return
    try {
      const { data: d } = await api.post(`/bookings/${id}/cancel`)
      toast.success(`Storniert${d.refund_amount > 0 ? ` · Rückerstattung: ${d.refund_amount} €` : ''}`)
      refetch()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">📋 Alle Buchungen</h1>
        <Btn variant="secondary" size="sm" onClick={refetch}><RefreshCw size={14} /> Aktualisieren</Btn>
      </div>

      {/* Filter bar */}
      <Card className="py-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buchungs-ID, Passagier, Route…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="all">Alle Status</option>
            <option value="reserved">Reserviert</option>
            <option value="ticketed">Ticket erhalten</option>
            <option value="cancelled">Storniert</option>
          </select>
          <select value={payFilter} onChange={e => setPayFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="all">Alle Zahlungen</option>
            <option value="paid">Bezahlt</option>
            <option value="unpaid">Unbezahlt</option>
          </select>
          {(search || statusFilter !== 'all' || payFilter !== 'all') && (
            <Btn variant="secondary" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setPayFilter('all') }}>
              ✕ Filter zurücksetzen
            </Btn>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">{filtered.length} von {data?.results?.length ?? 0} Buchungen</p>
      </Card>

      {isLoading && <p className="text-slate-500 text-sm">Lade…</p>}
      {!isLoading && !filtered.length && (
        <Card><p className="text-slate-500 text-sm">Keine Buchungen gefunden</p></Card>
      )}
      {filtered.map(b => {
        const names = Array.isArray(b.passenger_names) ? b.passenger_names : JSON.parse(b.passenger_names || '[]')
        return (
          <Card key={b.id}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div>
                <span className="font-mono font-bold text-slate-800">{b.id}</span>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status] || 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAY_COLOR[b.payment_status] || 'bg-slate-100'}`}>{b.payment_status}</span>
                </div>
              </div>
              <p className="text-sm font-semibold text-teal-700">{parseFloat(b.paid_price).toFixed(2)} €</p>
            </div>
            <p className="text-sm text-slate-600">
              Flug: <span className="font-mono">{b.flight_id}</span>
              {b.origin && b.destination && <span className="ml-2 text-teal-700 font-medium">{b.origin} → {b.destination}</span>}
              {b.airline && <span className="ml-2 text-slate-400">· {b.airline}</span>}
              <span className="ml-2 text-slate-400">· {fmtDt(b.created_at)}</span>
            </p>
            <p className="text-sm text-slate-600">Passagiere: {names.join(', ')}</p>
            {b.ticket_number && (
              <button
                onClick={() => setTicketFor(b)}
                className="text-sm text-teal-600 hover:text-teal-800 font-medium mt-0.5 flex items-center gap-1"
              >
                🎫 {b.ticket_number}
              </button>
            )}
            <p className="text-xs text-slate-400 mt-1">Letzte Aktion: {b.last_action}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {b.payment_status !== 'paid' && (
                <Btn size="sm" onClick={() => setActionFor({ booking: b, action: 'checkout' })}>💳 Bezahlen</Btn>
              )}
              <Btn variant="secondary" size="sm" onClick={() => setActionFor({ booking: b, action: 'rebook' })}>↻ Umbuchen</Btn>
              <Btn variant="secondary" size="sm" onClick={() => setActionFor({ booking: b, action: 'extras' })}>+ Extras</Btn>
              <Btn variant="secondary" size="sm" onClick={() => setActionFor({ booking: b, action: 'name' })}>✏ Korrektur</Btn>
              {b.payment_status === 'paid' && b.status !== 'ticketed' && (
                <Btn variant="success" size="sm" onClick={() => setActionFor({ booking: b, action: 'ticket' })}>🎫 Ticket ausstellen</Btn>
              )}
              {b.ticket_number && (
                <Btn variant="secondary" size="sm" onClick={() => setTicketFor(b)}>
                  <Printer size={13} /> Ticket
                </Btn>
              )}
              <Btn variant="secondary" size="sm" onClick={() => setNotesFor(b.id)}>
                <MessageSquare size={13} /> Notizen
              </Btn>
              {b.status !== 'cancelled' && (
                <Btn variant="danger" size="sm" onClick={() => cancelBooking(b.id)}>✕ Stornieren</Btn>
              )}
            </div>
          </Card>
        )
      })}

      {notesFor && <NotesModal bookingId={notesFor} onClose={() => setNotesFor(null)} />}
      {actionFor && (
        <ActionModal
          booking={actionFor.booking}
          action={actionFor.action}
          onClose={() => setActionFor(null)}
          onDone={() => refetch()}
        />
      )}
      {ticketFor && <TicketModal booking={ticketFor} onClose={() => setTicketFor(null)} />}
    </div>
  )
}
