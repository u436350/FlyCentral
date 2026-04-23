import { useState } from 'react'
import axios from 'axios'
import { Globe, Search, AlertCircle, CheckCircle, Clock, Info } from 'lucide-react'

const api = (path) => axios.get(`/api${path}`).then(r => r.data)

const COUNTRIES = [
  ['DE','🇩🇪 Deutschland'],['AT','🇦🇹 Österreich'],['CH','🇨🇭 Schweiz'],
  ['TR','🇹🇷 Türkei'],['US','🇺🇸 USA'],['AE','🇦🇪 VAE (Dubai)'],
  ['TH','🇹🇭 Thailand'],['EG','🇪🇬 Ägypten'],['MA','🇲🇦 Marokko'],
  ['GR','🇬🇷 Griechenland'],['ES','🇪🇸 Spanien'],['IT','🇮🇹 Italien'],
  ['HR','🇭🇷 Kroatien'],['IN','🇮🇳 Indien'],['MX','🇲🇽 Mexiko'],
  ['JP','🇯🇵 Japan'],['AU','🇦🇺 Australien'],['CN','🇨🇳 China'],
]

function reqBadge(req) {
  if (!req) return null
  const map = {
    visa_free:       { icon: <CheckCircle size={18}/>, label: 'Visumfrei',          bg: 'bg-green-100',  text: 'text-green-700'  },
    visa_required:   { icon: <AlertCircle size={18}/>, label: 'Visum erforderlich', bg: 'bg-red-100',    text: 'text-red-700'    },
    visa_on_arrival: { icon: <Clock size={18}/>,       label: 'Visa on Arrival',   bg: 'bg-yellow-100', text: 'text-yellow-700' },
    eta_required:    { icon: <Info size={18}/>,        label: 'ETA erforderlich',  bg: 'bg-blue-100',   text: 'text-blue-700'   },
    unknown:         { icon: <Info size={18}/>,        label: 'Unbekannt',         bg: 'bg-gray-100',   text: 'text-gray-700'   },
  }
  const m = map[req] || map.unknown
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${m.bg} ${m.text}`}>
      {m.icon} {m.label}
    </span>
  )
}

export default function VisaPage() {
  const [from, setFrom] = useState('DE')
  const [to, setTo]     = useState('TR')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  const check = async () => {
    if (from === to) return toast?.error?.('Start und Ziel sind gleich')
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await api(`/visa?from=${from}&to=${to}`)
      setResult(data)
    } catch (e) {
      setError(e.response?.data?.error || 'Keine Daten gefunden')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Globe size={28} className="text-blue-600"/>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visa-Information</h1>
          <p className="text-sm text-gray-500">Einreisebestimmungen für Ihre Kunden prüfen</p>
        </div>
      </div>

      {/* Auswahl */}
      <div className="bg-white rounded-2xl shadow border p-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Reisepass-Land (Staatsangehörigkeit)</label>
            <select value={from} onChange={e => setFrom(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Reiseziel (Land)</label>
            <select value={to} onChange={e => setTo(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
        </div>
        <button onClick={check} disabled={loading}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold">
          <Search size={18}/> {loading ? 'Prüfe…' : 'Visa-Anforderungen prüfen'}
        </button>
      </div>

      {/* Ergebnis */}
      {error && (
        <div className="mt-5 bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">
          <AlertCircle size={20} className="inline mr-2"/>{error}
        </div>
      )}

      {result && (
        <div className="mt-5 bg-white rounded-2xl shadow border p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              {COUNTRIES.find(c => c[0] === result.from_country)?.[1] || result.from_country}
              <span className="text-gray-400 mx-3">→</span>
              {COUNTRIES.find(c => c[0] === result.to_country)?.[1] || result.to_country}
            </h2>
            {reqBadge(result.requirement)}
          </div>

          {result.duration_days && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock size={16} className="text-gray-400"/>
              <span>Maximale Aufenthaltsdauer: <strong>{result.duration_days} Tage</strong></span>
            </div>
          )}

          {result.notes && (
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">ℹ️ Hinweise für Ihre Kunden:</p>
              <p className="leading-relaxed">{result.notes}</p>
            </div>
          )}

          {result.official_source && (
            <a href={result.official_source} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 underline flex items-center gap-1">
              <Globe size={14}/> Offizielle Quelle öffnen
            </a>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
            ⚠️ <strong>Haftungsausschluss:</strong> Diese Informationen sind nicht rechtsverbindlich. Bitte prüfen Sie aktuelle Einreisebestimmungen direkt beim zuständigen Konsulat oder auf <a href="https://www.auswaertiges-amt.de" target="_blank" rel="noopener noreferrer" className="underline">auswaertiges-amt.de</a>.
          </div>
        </div>
      )}

      {/* Häufige Routen */}
      {!result && !loading && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Häufige Routen</h3>
          <div className="grid grid-cols-2 gap-2">
            {[['DE','TR'],['DE','US'],['DE','TH'],['DE','EG'],['DE','AE'],['DE','IN']].map(([f,t]) => (
              <button key={`${f}-${t}`}
                onClick={() => { setFrom(f); setTo(t) }}
                className="text-left border rounded-xl px-4 py-3 text-sm hover:bg-blue-50 hover:border-blue-300 transition-colors">
                <span className="font-mono font-bold text-gray-700">{f}</span>
                <span className="text-gray-400 mx-2">→</span>
                <span className="font-mono font-bold text-gray-700">{t}</span>
                <br/>
                <span className="text-xs text-gray-400">
                  {COUNTRIES.find(c => c[0] === f)?.[1]?.split(' ')[1]} → {COUNTRIES.find(c => c[0] === t)?.[1]?.split(' ')[1]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
