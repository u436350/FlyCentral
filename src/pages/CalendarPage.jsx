import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Calendar, ChevronLeft, ChevronRight, Plane, Users } from 'lucide-react'

const api = (path) => axios.get(`/api${path}`).then(r => r.data)

function getDaysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }
function getFirstDayOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1).getDay() }

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const month = currentDate.getMonth()
  const year = currentDate.getFullYear()

  const { data: bookings } = useQuery({
    queryKey: ['bookings-calendar'],
    queryFn: () => api('/bookings'),
  })

  const allBookings = bookings?.results || []
  const bookingsByDate = {}
  allBookings.forEach(b => {
    const dateStr = b.created_at?.slice(0, 10)
    if (dateStr) {
      if (!bookingsByDate[dateStr]) bookingsByDate[dateStr] = []
      bookingsByDate[dateStr].push(b)
    }
  })

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const days = []

  // Leere Tage vom Vormonat
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }

  // Tage des Monats
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d)
  }

  const monthName = new Date(year, month).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const weekDays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

  const goToPrev = () => setCurrentDate(new Date(year, month - 1))
  const goToNext = () => setCurrentDate(new Date(year, month + 1))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Calendar size={28} className="text-blue-600"/>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buchungs-Kalender</h1>
          <p className="text-sm text-gray-500">Übersicht aller Buchungen nach Datum</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kalender */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow border overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6 flex justify-between items-center">
            <button onClick={goToPrev} className="p-2 hover:bg-white/20 rounded-lg">
              <ChevronLeft size={24}/>
            </button>
            <h2 className="text-xl font-bold capitalize">{monthName}</h2>
            <button onClick={goToNext} className="p-2 hover:bg-white/20 rounded-lg">
              <ChevronRight size={24}/>
            </button>
          </div>

          {/* Wochentage */}
          <div className="grid grid-cols-7 gap-0 border-b bg-gray-50">
            {weekDays.map(day => (
              <div key={day} className="p-3 text-center font-semibold text-xs text-gray-600 border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Tage */}
          <div className="grid grid-cols-7 gap-0">
            {days.map((day, idx) => {
              const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
              const dayBookings = dateStr ? bookingsByDate[dateStr] || [] : []

              return (
                <div
                  key={idx}
                  className={`min-h-32 p-2 border text-sm ${
                    day ? 'bg-white hover:bg-blue-50' : 'bg-gray-100 text-gray-400'
                  } ${day ? 'cursor-pointer' : ''}`}
                >
                  {day && (
                    <>
                      <p className={`font-bold mb-1 ${new Date(dateStr).toDateString() === new Date().toDateString() ? 'text-blue-600' : 'text-gray-800'}`}>
                        {day}
                      </p>
                      <div className="space-y-1">
                        {dayBookings.slice(0, 2).map((b, i) => (
                          <div
                            key={i}
                            className={`text-xs px-2 py-1 rounded truncate ${
                              b.payment_status === 'paid'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {b.flight_id?.slice(0, 8)}
                          </div>
                        ))}
                        {dayBookings.length > 2 && (
                          <div className="text-xs text-blue-600 font-semibold px-2">
                            +{dayBookings.length - 2} mehr
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Statistiken */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow border p-5">
            <h3 className="font-bold text-lg mb-4">Statistiken</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Buchungen diesen Monat:</span>
                <span className="font-bold text-lg text-blue-600">
                  {Object.values(bookingsByDate).filter(bb => bb[0]?.created_at?.slice(7, 10) === String(month + 1).padStart(2, '0')).length}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Gesamtumsatz:</span>
                <span className="font-bold text-green-600">
                  {allBookings.reduce((s, b) => s + (b.payment_status === 'paid' ? parseFloat(b.paid_price || 0) : 0), 0).toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Bezahlte Buchungen:</span>
                <span className="font-bold text-green-600">{allBookings.filter(b => b.payment_status === 'paid').length}</span>
              </div>
            </div>
          </div>

          {/* Legende */}
          <div className="bg-white rounded-2xl shadow border p-5">
            <h3 className="font-bold text-lg mb-4">Legende</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-100"></div>
                <span className="text-gray-700">Bezahlt</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-100"></div>
                <span className="text-gray-700">Ausstehend</span>
              </div>
            </div>
          </div>

          {/* Heutige Buchungen */}
          {bookingsByDate[new Date().toISOString().slice(0, 10)]?.length > 0 && (
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <Plane size={18}/> Heute ({bookingsByDate[new Date().toISOString().slice(0, 10)].length})
              </h3>
              <div className="space-y-2">
                {bookingsByDate[new Date().toISOString().slice(0, 10)].slice(0, 5).map((b, i) => (
                  <div key={i} className="text-sm bg-white rounded px-3 py-2 flex items-center justify-between">
                    <span><strong>{b.flight_id}</strong> · {b.passenger_names?.slice(0, 30)}</span>
                    <span className={`text-xs px-2 py-1 rounded ${b.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {b.payment_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
