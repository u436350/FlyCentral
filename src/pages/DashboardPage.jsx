import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { useAuthStore } from '../store/authStore'
import { Plane, BookOpen, Bell, BarChart2, ArrowRight, TrendingUp, Clock, CheckCircle } from 'lucide-react'

function fmtDt(s) {
  if (!s) return '–'
  return new Date(s).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

const STATUS_COLOR = {
  reserved:  'bg-yellow-100 text-yellow-700',
  ticketed:  'bg-green-100  text-green-700',
  cancelled: 'bg-red-100    text-red-700',
}

export default function DashboardPage() {
  const { email, role } = useAuthStore()

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn:  () => api.get('/stats').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: bookings } = useQuery({
    queryKey: ['bookings-recent'],
    queryFn:  () => api.get('/bookings').then(r => r.data),
    staleTime: 10_000,
  })

  const { data: analytics } = useQuery({
    queryKey: ['analytics-dash'],
    queryFn:  () => api.get('/analytics/bookings').then(r => r.data),
    staleTime: 30_000,
  })

  const recent = bookings?.results?.slice(0, 5) || []
  const greeting = new Date().getHours() < 12 ? 'Guten Morgen' : new Date().getHours() < 18 ? 'Guten Tag' : 'Guten Abend'

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-500 rounded-2xl p-6 text-white">
        <p className="text-teal-100 text-sm mb-1">{greeting} 👋</p>
        <h1 className="text-2xl font-bold mb-0.5">{email}</h1>
        <p className="text-teal-200 text-sm capitalize">Rolle: {role}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <BookOpen size={20} className="mx-auto text-teal-500 mb-2" />
          <p className="text-2xl font-bold text-slate-800">{stats?.bookings ?? '–'}</p>
          <p className="text-xs text-slate-500 mt-1">Buchungen</p>
        </Card>
        <Card className="text-center">
          <CheckCircle size={20} className="mx-auto text-green-500 mb-2" />
          <p className="text-2xl font-bold text-slate-800">{analytics?.summary?.paid_bookings ?? '–'}</p>
          <p className="text-xs text-slate-500 mt-1">Bezahlt</p>
        </Card>
        <Card className="text-center">
          <TrendingUp size={20} className="mx-auto text-indigo-500 mb-2" />
          <p className="text-2xl font-bold text-slate-800">
            {analytics?.summary?.total_revenue != null
              ? parseFloat(analytics.summary.total_revenue).toFixed(0) + ' €'
              : '–'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Umsatz</p>
        </Card>
        <Card className="text-center">
          <Bell size={20} className="mx-auto text-orange-500 mb-2" />
          <p className="text-2xl font-bold text-slate-800">{stats?.unread_notifications ?? '–'}</p>
          <p className="text-xs text-slate-500 mt-1">Ungelesene Alarme</p>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <h2 className="font-semibold text-slate-700 mb-3">Schnellzugriff</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/search">
            <Btn><Plane size={15} /> Flug suchen</Btn>
          </Link>
          <Link to="/bookings">
            <Btn variant="secondary"><BookOpen size={15} /> Alle Buchungen</Btn>
          </Link>
          <Link to="/fare-watch">
            <Btn variant="secondary"><Bell size={15} /> Preisalarm</Btn>
          </Link>
          <Link to="/analytics">
            <Btn variant="secondary"><BarChart2 size={15} /> Analytics</Btn>
          </Link>
        </div>
      </Card>

      {/* Recent Bookings */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700">Letzte Buchungen</h2>
          <Link to="/bookings" className="text-teal-600 hover:text-teal-800 text-sm flex items-center gap-1">
            Alle anzeigen <ArrowRight size={14} />
          </Link>
        </div>

        {!recent.length && (
          <div className="text-center py-8">
            <Plane size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">Noch keine Buchungen</p>
            <Link to="/search" className="mt-3 inline-block">
              <Btn size="sm">Jetzt Flug suchen</Btn>
            </Link>
          </div>
        )}

        <div className="space-y-2">
          {recent.map(b => {
            const names = Array.isArray(b.passenger_names) ? b.passenger_names : JSON.parse(b.passenger_names || '[]')
            return (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-slate-800">{b.id}</span>
                    {b.origin && b.destination && (
                      <span className="text-sm text-teal-700 font-medium">{b.origin} → {b.destination}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status] || 'bg-slate-100 text-slate-600'}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{names.join(', ')} · {fmtDt(b.created_at)}</p>
                </div>
                <p className="text-sm font-bold text-teal-700 shrink-0 ml-3">{parseFloat(b.paid_price).toFixed(2)} €</p>
              </div>
            )
          })}
        </div>
      </Card>

      {/* System status */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
        Alle Systeme aktiv · Stand: {new Date().toLocaleTimeString('de-DE', { timeStyle: 'short' })}
      </div>
    </div>
  )
}
