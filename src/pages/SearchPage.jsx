import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Card from '../components/Card'
import Btn from '../components/Btn'
import AirportInput from '../components/AirportInput'
import { airportLabel, AIRPORTS } from '../lib/airports'
import { Search, ArrowRight } from 'lucide-react'

const PRESETS = [
  ['FRA','JFK'], ['LHR','CDG'], ['MUC','DXB'], ['BER','BCN'], ['VIE','NRT'], ['CDG','HND'],
]

function AirportDisplay({ code }) {
  const city = AIRPORTS[code]
  return (
    <span className="flex flex-col items-center">
      <span className="font-bold text-lg leading-none">{code}</span>
      {city && <span className="text-xs text-slate-400 leading-none mt-0.5 whitespace-nowrap">{city}</span>}
    </span>
  )
}

function fmtDt(s) {
  if (!s) return '–'
  return new Date(s).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

export default function SearchPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    origin: '', destination: '', departure_date: '2026-05-28',
    airline: '', max_price: '', sort: 'price',
    returnFlight: false, return_date: '',
  })
  const [results, setResults]     = useState(null)
  const [retResults, setRetResults] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [bookingFlight, setBookingFlight] = useState(null)
  const [paxNames, setPaxNames]   = useState('Max Mustermann')
  const [bookingLoading, setBookingLoading] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const { data: catalog } = useQuery({
    queryKey: ['catalog'],
    queryFn:  () => api.get('/flights/catalog').then(r => r.data),
    staleTime: 60_000,
  })

  async function doSearch(overrideForm) {
    const f = overrideForm || form
    if (!f.origin || !f.destination) {
      toast.error('Bitte Von und Nach ausfüllen')
      return
    }
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('origin', f.origin)
      qs.set('destination', f.destination)
      if (f.departure_date) qs.set('departure_date', f.departure_date)
      if (f.airline)        qs.set('airline', f.airline)
      if (f.max_price)      qs.set('max_price', f.max_price)
      qs.set('sort', f.sort)

      if (f.returnFlight && f.return_date) {
        const [outR, retR] = await Promise.all([
          api.get(`/flights/search?${qs}`),
          api.get(`/flights/search?origin=${f.destination}&destination=${f.origin}&departure_date=${f.return_date}&sort=${f.sort}`),
        ])
        setResults(outR.data.results)
        setRetResults(retR.data.results)
      } else {
        const { data } = await api.get(`/flights/search?${qs}`)
        setResults(data.results)
        setRetResults(null)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  function quickSearch(from, to) {
    const next = { ...form, origin: from, destination: to }
    setForm(next)
    doSearch(next)
  }

  async function bookFlight() {
    const names = paxNames.split('\n').map(s => s.trim()).filter(Boolean)
    if (!names.length) return toast.error('Passagiernamen angeben')
    setBookingLoading(true)
    try {
      await api.post('/bookings', { flight_id: bookingFlight.id, passenger_names: names })
      toast.success('Buchung erstellt!')
      setBookingFlight(null)
      nav('/bookings')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBookingLoading(false)
    }
  }

  function FlightCard({ f, label }) {
    const dur   = f.duration_minutes ? `${Math.floor(f.duration_minutes / 60)}h ${f.duration_minutes % 60}m` : ''
    const stops = f.stops === 0 ? 'Direktflug' : f.stops != null ? `${f.stops} Stopp(s)` : ''
    return (
      <Card className="hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {label && <span className="inline-block text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full mb-2">{label}</span>}
            <div className="flex items-center gap-3">
              <AirportDisplay code={f.origin} />
              <ArrowRight size={18} className="text-slate-300 shrink-0" />
              <AirportDisplay code={f.destination} />
              {f.provider && f.provider !== 'demo' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{f.provider.toUpperCase()}</span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1.5">{f.airline}{dur && ` · ${dur}`}{stops && ` · ${stops}`}</p>
            <p className="text-xs text-slate-400">{fmtDt(f.departure_at)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-teal-700">{f.final_price} €</p>
            <p className="text-xs text-slate-400">+{f.markup_percent}% Aufschlag</p>
            <Btn size="sm" className="mt-2" onClick={() => { setBookingFlight(f); setPaxNames('Max Mustermann') }}>
              Buchen
            </Btn>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">✈ Flüge suchen</h1>
        <p className="text-teal-100 text-sm">{catalog?.live_market_enabled ? '🟢 Duffel Live-Markt aktiv' : '🟡 Demo-Katalog'} · {catalog?.flight_count || 0} Flüge verfügbar</p>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([from, to]) => (
          <button key={`${from}-${to}`} onClick={() => quickSearch(from, to)}
            className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:bg-teal-50 hover:border-teal-300 transition-colors font-medium text-slate-600">
            {airportLabel(from)} → {airportLabel(to)}
          </button>
        ))}
      </div>

      {/* Search Form */}
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Von</label>
            <AirportInput
              value={form.origin}
              onChange={code => setForm(f => ({ ...f, origin: code || '' }))}
              placeholder="Stadt oder Flughafen-Code"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nach</label>
            <AirportInput
              value={form.destination}
              onChange={code => setForm(f => ({ ...f, destination: code || '' }))}
              placeholder="Stadt oder Flughafen-Code"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hinflug-Datum</label>
            <input type="date" value={form.departure_date} onChange={set('departure_date')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Airline</label>
            <input list="airlines" value={form.airline} onChange={set('airline')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Alle Fluglinien" />
            <datalist id="airlines">{catalog?.airlines?.map(a => <option key={a} value={a} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Max Preis €</label>
            <input type="number" value={form.max_price} onChange={set('max_price')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="9999" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sortierung</label>
            <select value={form.sort} onChange={set('sort')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="price">Günstigste zuerst</option>
              <option value="duration">Schnellste zuerst</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 mb-2 cursor-pointer">
              <input type="checkbox" checked={form.returnFlight} onChange={set('returnFlight')} className="rounded" />
              Rückflug
            </label>
          </div>
          {form.returnFlight && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rückflug-Datum</label>
              <input type="date" value={form.return_date} onChange={set('return_date')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Btn onClick={() => doSearch()} disabled={loading} size="lg">
            <Search size={16} /> {loading ? 'Suche läuft…' : 'Flüge suchen'}
          </Btn>
          {(form.origin || form.destination) && (
            <button onClick={() => { setForm(f => ({ ...f, origin: '', destination: '' })); setResults(null); setRetResults(null) }}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
              Zurücksetzen
            </button>
          )}
        </div>
      </Card>

      {/* Results */}
      {results !== null && (
        <div className="space-y-3">
          {retResults ? (
            <>
              <h2 className="font-semibold text-slate-700">✈ Hinflug – {results.length} Angebote</h2>
              {results.length ? results.map(f => <FlightCard key={f.id} f={f} />) : <p className="text-slate-500 text-sm">Keine Hinflüge</p>}
              <h2 className="font-semibold text-slate-700 mt-4">↩ Rückflug – {retResults.length} Angebote</h2>
              {retResults.length ? retResults.map(f => <FlightCard key={f.id} f={f} label="Rückflug" />) : <p className="text-slate-500 text-sm">Keine Rückflüge</p>}
            </>
          ) : (
            <>
              <h2 className="font-semibold text-slate-700">
                {results.length} Ergebnis{results.length !== 1 ? 'se' : ''}{form.origin && ` – ${airportLabel(form.origin)}`}{form.destination && ` → ${airportLabel(form.destination)}`}
              </h2>
              {results.length ? results.map(f => <FlightCard key={f.id} f={f} />) : (
                <Card><p className="text-slate-500 text-sm">Keine Flüge gefunden.</p></Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Booking Modal */}
      {bookingFlight && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="font-bold text-lg mb-2">✈ Flug buchen</h2>
            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="font-bold text-slate-800">{bookingFlight.origin}</p>
                <p className="text-xs text-slate-500">{AIRPORTS[bookingFlight.origin] || ''}</p>
              </div>
              <ArrowRight size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className="font-bold text-slate-800">{bookingFlight.destination}</p>
                <p className="text-xs text-slate-500">{AIRPORTS[bookingFlight.destination] || ''}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="font-bold text-teal-700">{bookingFlight.final_price} €</p>
                <p className="text-xs text-slate-500">{bookingFlight.airline}</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Passagiernamen (einer pro Zeile)</label>
            <textarea rows={4} value={paxNames} onChange={e => setPaxNames(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <div className="flex gap-2">
              <Btn onClick={bookFlight} disabled={bookingLoading}>
                {bookingLoading ? 'Buche…' : 'Buchung anlegen'}
              </Btn>
              <Btn variant="secondary" onClick={() => setBookingFlight(null)}>Abbrechen</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
