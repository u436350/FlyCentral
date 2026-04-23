import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import Card from '../components/Card'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts'
import { useAuthStore } from '../store/authStore'

export default function AnalyticsPage() {
  const { role } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn:  () => api.get('/analytics/bookings').then(r => r.data),
    staleTime: 30_000,
  })

  const { data: revenue } = useQuery({
    queryKey: ['analytics-revenue'],
    queryFn:  () => api.get('/analytics/revenue').then(r => r.data),
    staleTime: 30_000,
  })

  const { data: conversion } = useQuery({
    queryKey: ['analytics-conversion'],
    queryFn:  () => api.get('/analytics/conversion').then(r => r.data),
    staleTime: 30_000,
  })

  const { data: perf } = useQuery({
    queryKey: ['analytics-performance'],
    queryFn:  () => api.get('/analytics/agent-performance').then(r => r.data),
    staleTime: 30_000,
  })

  const { data: heatmap } = useQuery({
    queryKey: ['analytics-heatmap'],
    queryFn:  () => api.get('/analytics/destination-heatmap').then(r => r.data),
    staleTime: 30_000,
  })

  const { data: adminData } = useQuery({
    queryKey: ['analytics-admin'],
    queryFn:  () => api.get('/analytics/admin').then(r => r.data),
    enabled: role === 'admin',
    staleTime: 30_000,
  })

  const COLORS = ['#0d9488', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#6366f1']

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">📊 Analytics & Reports</h1>

      {isLoading && <p className="text-gray-500 text-sm">Lade…</p>}

      {/* Main Stats */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Buchungen gesamt', data.summary.total_bookings],
            ['Davon bezahlt',    data.summary.paid_bookings],
            ['Umsatz (€)',       parseFloat(data.summary.total_revenue ?? 0).toFixed(2)],
            ['Stornierungen',    data.summary.cancelled_bookings],
          ].map(([label, val]) => (
            <Card key={label} className="text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-teal-700">{val}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Revenue Dashboard */}
      {revenue && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="text-center">
            <p className="text-xs text-gray-500 mb-1">Gesamtumsatz</p>
            <p className="text-3xl font-bold text-green-600">{revenue.total_revenue?.toFixed(2)} €</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-gray-500 mb-1">Davon eingenommen</p>
            <p className="text-3xl font-bold text-green-500">{revenue.completed_revenue?.toFixed(2)} €</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-gray-500 mb-1">Durchschnitt pro Buchung</p>
            <p className="text-3xl font-bold text-blue-600">{revenue.avg_transaction?.toFixed(2)} €</p>
          </Card>
        </div>
      )}

      {/* Conversion Funnel */}
      {conversion && (
        <Card>
          <h2 className="font-bold text-lg mb-4">🔄 Buchungs-Trichter</h2>
          <div className="space-y-3">
            <div className="text-sm">
              <div className="flex justify-between mb-1"><span>Buchungen erstellt</span><span className="font-bold">{conversion.total_bookings}</span></div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden"><div className="bg-blue-500 h-full" style={{width: '100%'}}/></div>
            </div>
            <div className="text-sm">
              <div className="flex justify-between mb-1"><span>Bezahlt ({((conversion.paid_bookings / conversion.total_bookings) * 100).toFixed(0)}%)</span><span className="font-bold">{conversion.paid_bookings}</span></div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden"><div className="bg-green-500 h-full" style={{width: ((conversion.paid_bookings / conversion.total_bookings) * 100) + '%'}}/></div>
            </div>
            <div className="text-sm">
              <div className="flex justify-between mb-1"><span>Mit Ticket ({((conversion.ticketed_bookings / conversion.total_bookings) * 100).toFixed(0)}%)</span><span className="font-bold">{conversion.ticketed_bookings}</span></div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden"><div className="bg-purple-500 h-full" style={{width: ((conversion.ticketed_bookings / conversion.total_bookings) * 100) + '%'}}/></div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-semibold text-blue-900">Conversion Rate: <span className="text-lg">{conversion.conversion_rate?.toFixed(1)}%</span></p>
            </div>
          </div>
        </Card>
      )}

      {/* Agent Performance */}
      {perf?.agents?.length > 0 && (
        <Card>
          <h2 className="font-bold text-lg mb-4">🏆 Agent Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={perf.agents}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="email" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="total_bookings" fill="#0d9488" name="Buchungen" />
              <Bar yAxisId="right" dataKey="total_revenue" fill="#059669" name="Umsatz (€)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Destination Heatmap */}
      {heatmap?.top_routes?.length > 0 && (
        <Card>
          <h2 className="font-bold text-lg mb-4">🌍 Top Reiseziele</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {heatmap.top_routes.slice(0, 8).map((route, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-800">{route.origin} → {route.destination}</span>
                <span className="text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{route.booking_count} 📊</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Daily Chart */}
      {data?.daily?.length > 0 && (
        <Card>
          <h2 className="font-semibold text-gray-700 mb-3">📈 Buchungen pro Tag (30 Tage)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Top Routes */}
      {data?.top_routes?.length > 0 && (
        <Card>
          <h2 className="font-semibold text-gray-700 mb-3">🚀 Top Routen</h2>
          <div className="space-y-2">
            {data.top_routes.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 rounded">
                <span className="font-medium text-gray-700">{i+1}. {r.route}</span>
                <span className="text-teal-600 font-semibold">{r.count} Buchungen</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Agent Leaderboard */}
      {data?.leaderboard?.length > 0 && (
        <Card>
          <h2 className="font-bold text-lg mb-4">🏆 Agent Leaderboard</h2>
          <div className="space-y-2">
            {data.leaderboard.map((a, i) => (
              <div key={a.email} className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-transparent hover:from-blue-100 transition">
                <span className="text-xl font-bold text-gray-400 w-8">{i+1}.</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{a.email}</p>
                  <p className="text-xs text-gray-500">{a.total_bookings} Buchungen · {parseFloat(a.total_revenue ?? 0).toFixed(2)} €</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-teal-600">{parseFloat(a.total_revenue ?? 0).toFixed(0)}€</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Admin-wide chart */}
      {role === 'admin' && adminData?.by_tenant?.length > 0 && (
        <Card>
          <h2 className="font-semibold text-gray-700 mb-3">🏢 Buchungen nach Tenant</h2>
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
