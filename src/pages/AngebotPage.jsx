import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { FileText, Download, User, Plane, Hotel, Tag, Info } from 'lucide-react'

const api = (path) => axios.get(`/api${path}`).then(r => r.data)

async function generateAngebotPdf({ customer, flight, hotel, transfer, discount, finalPrice, agencyName }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4', unit: 'mm' })
  const W = 210, margin = 18

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.setFillColor(37, 99, 235)  // blue-600
  doc.rect(0, 0, W, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(agencyName || 'FlyCentral Reisebüro', margin, 18)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Reiseangebot / Kostenvoranschlag', margin, 28)
  doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, W - margin - 40, 28)

  let y = 52

  // ── Kunde ──────────────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Kundendaten', margin, y)
  y += 6
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, W - margin, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (customer) {
    doc.text(`Name:           ${customer.first_name} ${customer.last_name}`, margin, y); y += 6
    if (customer.email)   { doc.text(`E-Mail:         ${customer.email}`, margin, y); y += 6 }
    if (customer.phone)   { doc.text(`Telefon:        ${customer.phone}`, margin, y); y += 6 }
    if (customer.passport_number) { doc.text(`Reisepass-Nr.:  ${customer.passport_number}`, margin, y); y += 6 }
    if (customer.nationality) { doc.text(`Staatsangehörigkeit: ${customer.nationality}`, margin, y); y += 6 }
  } else {
    doc.text('– kein Kunde zugewiesen –', margin, y); y += 6
  }
  y += 6

  // ── Flug ───────────────────────────────────────────────────────────────────
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Flugdetails', margin, y)
  y += 6
  doc.line(margin, y, W - margin, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (flight) {
    doc.text(`Strecke:        ${flight.origin || '–'} → ${flight.destination || '–'}`, margin, y); y += 6
    doc.text(`Flug-Nr.:       ${flight.id || '–'}`, margin, y); y += 6
    if (flight.airline)      { doc.text(`Airline:        ${flight.airline}`, margin, y); y += 6 }
    if (flight.departure)    { doc.text(`Abflug:         ${new Date(flight.departure).toLocaleString('de-DE')}`, margin, y); y += 6 }
    if (flight.arrival)      { doc.text(`Ankunft:        ${new Date(flight.arrival).toLocaleString('de-DE')}`, margin, y); y += 6 }
    doc.text(`Basispreis:     ${parseFloat(flight.base_price || 0).toFixed(2)} €`, margin, y); y += 6
  } else {
    doc.text('– Flug manuell einzutragen –', margin, y); y += 6
  }
  y += 6

  // ── Hotel ──────────────────────────────────────────────────────────────────
  if (hotel?.name) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Hotel', margin, y)
    y += 6
    doc.line(margin, y, W - margin, y)
    y += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Hotel:          ${hotel.name}`, margin, y); y += 6
    doc.text(`Sterne:         ${'★'.repeat(hotel.stars || 0)}`, margin, y); y += 6
    doc.text(`Nächte:         ${hotel.nights || 0}`, margin, y); y += 6
    y += 6
  }

  // ── Transfer ───────────────────────────────────────────────────────────────
  if (transfer) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(34, 197, 94)
    doc.text('✓ Transfer (Flughafen ↔ Hotel) inbegriffen', margin, y); y += 8
    doc.setTextColor(30, 30, 30)
  }

  // ── Preisübersicht ─────────────────────────────────────────────────────────
  y += 4
  doc.setFillColor(243, 244, 246)  // gray-100
  doc.rect(margin, y - 4, W - 2 * margin, discount ? 44 : 34, 'F')
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Preisübersicht', margin + 4, y + 4)
  y += 12
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Grundpreis:     ${parseFloat(flight?.base_price || 0).toFixed(2)} €`, margin + 4, y); y += 6

  if (discount) {
    doc.setTextColor(239, 68, 68)  // red
    doc.text(`Rabatt (${discount.code}): -${parseFloat(discount.discount || 0).toFixed(2)} €`, margin + 4, y); y += 6
    doc.setTextColor(30, 30, 30)
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text(`Gesamtpreis:    ${parseFloat(finalPrice || 0).toFixed(2)} €`, margin + 4, y); y += 14
  doc.setTextColor(30, 30, 30)

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pageH = 297
  doc.setFillColor(37, 99, 235)
  doc.rect(0, pageH - 18, W, 18, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 255, 255)
  doc.text(`${agencyName || 'FlyCentral'} · Dieses Angebot ist unverbindlich und gilt 14 Tage ab Ausstellungsdatum.`, margin, pageH - 7)

  doc.save(`Angebot_${customer?.last_name || 'Kunde'}_${new Date().toISOString().slice(0,10)}.pdf`)
}

export default function AngebotPage() {
  const [customerId, setCustomerId] = useState('')
  const [flightId,   setFlightId]   = useState('')
  const [hotel,      setHotel]      = useState({ name: '', stars: 4, nights: 7 })
  const [transfer,   setTransfer]   = useState(false)
  const [discountCode, setDiscountCode] = useState('')
  const [discountResult, setDiscountResult] = useState(null)
  const [finalPrice, setFinalPrice] = useState('')
  const [generating, setGenerating] = useState(false)

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => api('/customers') })
  const { data: flights }   = useQuery({ queryKey: ['flights'],   queryFn: () => api('/flights') })

  const selectedCustomer = customers?.results?.find(c => c.id === customerId) || null
  const selectedFlight   = flights?.flights?.find(f => f.id === flightId) || null

  const validateDiscount = async () => {
    if (!discountCode.trim() || !finalPrice) return
    try {
      const res = await axios.post('/api/discounts/validate', { code: discountCode, original_price: parseFloat(finalPrice) })
      setDiscountResult(res.data)
      toast.success(`Rabatt: -${res.data.discount} €`)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Ungültiger Code')
      setDiscountResult(null)
    }
  }

  const generate = async () => {
    if (!finalPrice) return toast.error('Bitte Gesamtpreis angeben')
    setGenerating(true)
    try {
      await generateAngebotPdf({
        customer: selectedCustomer,
        flight:   selectedFlight,
        hotel,
        transfer,
        discount: discountResult,
        finalPrice: discountResult?.final_price ?? finalPrice,
        agencyName: 'FlyCentral Reisebüro',
      })
      toast.success('PDF erstellt ✅')
    } catch (e) {
      toast.error('PDF-Fehler: ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={28} className="text-blue-600"/>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Angebot erstellen</h1>
          <p className="text-sm text-gray-500">Reiseangebot als PDF für Ihren Kunden</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow border p-6 flex flex-col gap-5">
        {/* Kunde */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"><User size={16}/> Kunde</label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">– Kein Kunde –</option>
            {customers?.results?.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email || c.phone})</option>)}
          </select>
        </div>

        {/* Flug */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"><Plane size={16}/> Flug</label>
          <select value={flightId} onChange={e => { setFlightId(e.target.value); const f = flights?.flights?.find(fl => fl.id === e.target.value); if (f) setFinalPrice(f.base_price?.toString()) }}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">– Kein Flug –</option>
            {flights?.flights?.map(f => <option key={f.id} value={f.id}>{f.origin} → {f.destination} · {f.airline} · {parseFloat(f.base_price).toFixed(2)} €</option>)}
          </select>
        </div>

        {/* Hotel */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"><Hotel size={16}/> Hotel</label>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 md:col-span-1">
              <input value={hotel.name} onChange={e => setHotel(p => ({ ...p, name: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Hotelname (optional)"/>
            </div>
            <div>
              <select value={hotel.stars} onChange={e => setHotel(p => ({ ...p, stars: parseInt(e.target.value) }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
            <div>
              <input type="number" min="0" value={hotel.nights} onChange={e => setHotel(p => ({ ...p, nights: parseInt(e.target.value) }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nächte"/>
            </div>
          </div>
        </div>

        {/* Transfer */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={transfer} onChange={e => setTransfer(e.target.checked)} className="w-4 h-4 text-blue-600"/>
          <span className="text-sm text-gray-700">Transfer (Flughafen ↔ Hotel) inbegriffen</span>
        </label>

        {/* Preis */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"><Info size={16}/> Gesamtpreis (€)</label>
          <input type="number" min="0" step="0.01" value={finalPrice} onChange={e => { setFinalPrice(e.target.value); setDiscountResult(null) }}
            className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="799.00"/>
        </div>

        {/* Rabattcode */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"><Tag size={16}/> Rabattcode (optional)</label>
          <div className="flex gap-2">
            <input value={discountCode} onChange={e => setDiscountCode(e.target.value.toUpperCase())}
              className="flex-1 border rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="SOMMER25"/>
            <button onClick={validateDiscount}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium">
              Prüfen
            </button>
          </div>
          {discountResult && (
            <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
              ✅ Rabatt angewendet: <strong>-{discountResult.discount} €</strong> → Endpreis: <strong>{discountResult.final_price} €</strong>
            </div>
          )}
        </div>

        {/* Vorschau-Zusammenfassung */}
        <div className="bg-gray-50 rounded-xl p-4 text-sm border">
          <p className="font-semibold text-gray-700 mb-2">Angebots-Vorschau:</p>
          <ul className="space-y-1 text-gray-600">
            <li>👤 Kunde: {selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : '–'}</li>
            <li>✈️ Flug: {selectedFlight ? `${selectedFlight.origin} → ${selectedFlight.destination}` : '–'}</li>
            <li>🏨 Hotel: {hotel.name || '–'} {hotel.name ? `(${hotel.stars}★, ${hotel.nights}N)` : ''}</li>
            <li>🚌 Transfer: {transfer ? 'Ja' : 'Nein'}</li>
            <li>💶 Preis: {discountResult ? `${discountResult.final_price} €` : finalPrice ? `${parseFloat(finalPrice).toFixed(2)} €` : '–'}</li>
          </ul>
        </div>

        <button onClick={generate} disabled={generating}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold text-base">
          <Download size={20}/> {generating ? 'Erstelle PDF…' : 'Angebot als PDF herunterladen'}
        </button>
      </div>
    </div>
  )
}
