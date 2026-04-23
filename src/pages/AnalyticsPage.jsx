import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import Card from '../components/Card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useAuthStore } from '../store/authStore'

export default function AnalyticsPage() {
  const { role } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn:  () => api.get('/analytics/bookings').then(r => r.data),
    staleTime: 30_000,
  })

  const { data: adminData } = useQuery({
    queryKey: ['analytics-admin'],
    queryFn:  () => api.get('/analytics/admin').then(r => r.data),
    enabled: role === 'admin',
    staleTime: 30_000,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">📊 Analytics</h1>

      {isLoading && <p className="text-slate-500 text-sm">Lade…</p>}

      {/* Stat Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Buchungen gesamt', data.summary.total_bookings],
            ['Davon bezahlt',    data.summary.paid_bookings],
            ['Umsatz (€)',       parseFloat(data.summary.total_revenue ?? 0).toFixed(2)],
            ['Stornierungen',    data.summary.cancelled_bookings],
          ].map(([label, val]) => (
            <Card key={label} className="text-center">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-teal-700">{val}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Daily Chart */}
      {data?.daily?.length > 0 && (
        <Card>
          <h2 className="font-semibold text-slate-700 mb-3">Buchungen pro Tag (30 Tage)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0d9488" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Top Routes */}
      {data?.top_routes?.length > 0 && (
        <Card>
          <h2 className="font-semibold text-slate-700 mb-3">Top Routen</h2>
          <div className="space-y-2">
            {data.top_routes.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{r.route}</span>
                <span className="text-teal-600 font-semibold">{r.count} Buchungen</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Agent Leaderboard */}
      {data?.leaderboard?.length > 0 && (
        <Card>
          <h2 className="font-semibold text-slate-700 mb-3">🏆 Agent Leaderboard</h2>
          <div className="space-y-2">
            {data.leaderboard.map((a, i) => (
              <div key={a.email} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                <span className="text-lg font-bold text-slate-400 w-6">{i+1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{a.email}</p>
                  <p className="text-xs text-slate-500">{a.total_bookings} Buchungen · {parseFloat(a.total_revenue ?? 0).toFixed(2)} €</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Admin-wide chart */}
      {role === 'admin' && adminData?.by_tenant?.length > 0 && (
        <Card>
          <h2 className="font-semibold text-slate-700 mb-3">🏢 Buchungen nach Tenant</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={adminData.by_tenant}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="tenant_id" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total_bookings" fill="#6366f1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
