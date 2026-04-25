import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const STORAGE_KEY = 'flycentral-api-base-url'
const DEMO_FALLBACK_ENABLED = import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true'
const API_FAILOVER_ENABLED = import.meta.env.VITE_ENABLE_API_URL_FAILOVER === 'true'
const DEFAULT_API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:4001'
  : 'https://flycentral.onrender.com'
const CONFIGURED_API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL)
const INVALID_BASE_URLS = new Set([
  'https://flycentral-api.onrender.com',
])

const FALLBACK_BASE_URLS = API_FAILOVER_ENABLED
  ? [
      CONFIGURED_API_BASE_URL,
      'https://flycentral.onrender.com',
    ].filter(Boolean)
  : [CONFIGURED_API_BASE_URL].filter(Boolean)

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/$/, '')
}

function sanitizeStoredBaseUrl(url) {
  const normalized = normalizeBaseUrl(url)
  if (!normalized) return ''

  if (INVALID_BASE_URLS.has(normalized)) {
    localStorage.removeItem(STORAGE_KEY)
    return ''
  }

  return normalized
}

const storedBaseUrl = sanitizeStoredBaseUrl(localStorage.getItem(STORAGE_KEY) || '')
let activeBaseUrl = CONFIGURED_API_BASE_URL || storedBaseUrl || FALLBACK_BASE_URLS[0] || ''

if (CONFIGURED_API_BASE_URL && !API_FAILOVER_ENABLED) {
  activeBaseUrl = CONFIGURED_API_BASE_URL
}

export function getActiveApiBaseUrl() {
  return activeBaseUrl
}

export function isDemoFallbackEnabled() {
  return DEMO_FALLBACK_ENABLED
}

function setActiveApiBaseUrl(nextUrl) {
  const normalized = normalizeBaseUrl(nextUrl)
  if (!normalized) return
  activeBaseUrl = normalized
  localStorage.setItem(STORAGE_KEY, normalized)
  api.defaults.baseURL = `${normalized}/api`
}

const api = axios.create({
  baseURL: activeBaseUrl ? `${activeBaseUrl}/api` : '/api',
  timeout: 15000,
})

let isSwitchingBaseUrl = false

const DEMO_DB = {
  bookings: [
    {
      id: 'BK-1001',
      flight_id: 'FL-IST-BER-01',
      origin: 'IST',
      destination: 'BER',
      airline: 'Turkish Airlines',
      departure_at: '2026-05-20T09:15:00.000Z',
      passenger_names: ['Max Mustermann', 'Anna Mustermann'],
      paid_price: 489.0,
      payment_status: 'paid',
      status: 'ticketed',
      ticket_number: 'TK-998877',
      created_at: '2026-04-20T10:10:00.000Z',
    },
    {
      id: 'BK-1002',
      flight_id: 'FL-FRA-DXB-12',
      origin: 'FRA',
      destination: 'DXB',
      airline: 'Emirates',
      departure_at: '2026-05-24T13:30:00.000Z',
      passenger_names: ['John Doe'],
      paid_price: 799.0,
      payment_status: 'unpaid',
      status: 'reserved',
      ticket_number: null,
      created_at: '2026-04-21T11:20:00.000Z',
    },
  ],
  notes: {
    'BK-1001': [
      { id: 1, note: 'Customer requested window seats.', user_email: 'agent@berlin.com', created_at: '2026-04-20T12:00:00.000Z' },
    ],
    'BK-1002': [],
  },
  fareWatch: [
    { id: 1, origin: 'FRA', destination: 'JFK', max_price: 450, departure_date: '2026-06-01', is_active: true },
  ],
  notifications: [
    { id: 1, title: 'Price Alert Triggered', message: 'Route FRA -> JFK is now below 450 EUR.', type: 'price_alert', created_at: '2026-04-22T08:00:00.000Z', read_at: null },
  ],
  invoices: [
    { id: 'INV-2026-04', period: '2026-04', total_amount: 1299, status: 'pending', due_date: '2026-05-05T00:00:00.000Z', booking_ids: ['BK-1001', 'BK-1002'] },
  ],
}

function mockResponse(config, data, status = 200) {
  return Promise.resolve({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
  })
}

function extractPathAndParams(url = '') {
  const [path, query = ''] = String(url).split('?')
  return { path, params: new URLSearchParams(query) }
}

function demoFlights(origin = 'FRA', destination = 'JFK') {
  return [
    {
      id: `${origin}-${destination}-1`,
      origin,
      destination,
      airline: 'Lufthansa',
      departure_at: '2026-05-28T08:00:00.000Z',
      duration_minutes: 510,
      stops: 0,
      final_price: 540,
      markup_percent: 12,
      provider: 'demo',
    },
    {
      id: `${origin}-${destination}-2`,
      origin,
      destination,
      airline: 'Turkish Airlines',
      departure_at: '2026-05-28T12:30:00.000Z',
      duration_minutes: 580,
      stops: 1,
      final_price: 470,
      markup_percent: 12,
      provider: 'demo',
    },
  ]
}

function getMockData(config) {
  const method = String(config.method || 'get').toLowerCase()
  const { path, params } = extractPathAndParams(config.url)

  if (method === 'get' && path === '/stats') {
    return { bookings: DEMO_DB.bookings.length, unread_notifications: DEMO_DB.notifications.filter(n => !n.read_at).length }
  }

  if (method === 'get' && path === '/bookings') {
    return { results: DEMO_DB.bookings }
  }

  if (method === 'post' && path === '/bookings') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {})
    const created = {
      id: `BK-${1000 + DEMO_DB.bookings.length + 1}`,
      flight_id: body.flight_id || 'FL-DEMO-NEW',
      origin: 'FRA',
      destination: 'JFK',
      airline: 'Lufthansa',
      departure_at: '2026-06-03T10:00:00.000Z',
      passenger_names: body.passenger_names || ['Demo Passenger'],
      paid_price: 520,
      payment_status: 'unpaid',
      status: 'reserved',
      ticket_number: null,
      created_at: new Date().toISOString(),
    }
    DEMO_DB.bookings.unshift(created)
    return { ok: true, booking: created }
  }

  const notesGetMatch = path.match(/^\/bookings\/([^/]+)\/notes$/)
  if (method === 'get' && notesGetMatch) {
    const bookingId = notesGetMatch[1]
    return { notes: DEMO_DB.notes[bookingId] || [] }
  }

  const notesPostMatch = path.match(/^\/bookings\/([^/]+)\/notes$/)
  if (method === 'post' && notesPostMatch) {
    const bookingId = notesPostMatch[1]
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {})
    const note = {
      id: Date.now(),
      note: body.note || '',
      user_email: useAuthStore.getState().email || 'agent@berlin.com',
      created_at: new Date().toISOString(),
    }
    if (!DEMO_DB.notes[bookingId]) DEMO_DB.notes[bookingId] = []
    DEMO_DB.notes[bookingId].unshift(note)
    return { ok: true }
  }

  const cancelMatch = path.match(/^\/bookings\/([^/]+)\/cancel$/)
  if (method === 'post' && cancelMatch) {
    const bookingId = cancelMatch[1]
    const booking = DEMO_DB.bookings.find(b => b.id === bookingId)
    if (booking) {
      booking.status = 'cancelled'
      return { ok: true, refund_amount: booking.payment_status === 'paid' ? Number((booking.paid_price * 0.85).toFixed(2)) : 0 }
    }
    return { ok: true, refund_amount: 0 }
  }

  const ticketActionMatch = path.match(/^\/bookings\/([^/]+)\/(checkout|pay|rebook|extras|name-correction|ticket)$/)
  if (method === 'post' && ticketActionMatch) {
    const bookingId = ticketActionMatch[1]
    const action = ticketActionMatch[2]
    const booking = DEMO_DB.bookings.find(b => b.id === bookingId)
    if (booking && (action === 'pay' || action === 'ticket' || action === 'checkout')) {
      booking.payment_status = 'paid'
      booking.status = 'ticketed'
      booking.ticket_number = booking.ticket_number || `TK-${Math.floor(100000 + Math.random() * 900000)}`
      return { ok: true, ticket_number: booking.ticket_number }
    }
    return { ok: true }
  }

  if (method === 'get' && path === '/analytics/bookings') {
    return {
      summary: {
        total_bookings: DEMO_DB.bookings.length,
        paid_bookings: DEMO_DB.bookings.filter(b => b.payment_status === 'paid').length,
        cancelled_bookings: DEMO_DB.bookings.filter(b => b.status === 'cancelled').length,
        total_revenue: DEMO_DB.bookings.filter(b => b.payment_status === 'paid').reduce((s, b) => s + Number(b.paid_price || 0), 0),
      },
      by_payment_status: [
        { name: 'paid', value: DEMO_DB.bookings.filter(b => b.payment_status === 'paid').length },
        { name: 'unpaid', value: DEMO_DB.bookings.filter(b => b.payment_status !== 'paid').length },
      ],
      by_destination: [
        { destination: 'BER', count: 8 },
        { destination: 'DXB', count: 6 },
        { destination: 'JFK', count: 4 },
      ],
      daily: [
        { day: 'Mon', bookings: 4 },
        { day: 'Tue', bookings: 6 },
        { day: 'Wed', bookings: 5 },
        { day: 'Thu', bookings: 7 },
        { day: 'Fri', bookings: 3 },
      ],
    }
  }

  if (method === 'get' && path === '/analytics/revenue') {
    return { total_revenue: 24890.5, completed_revenue: 19890.25, avg_transaction: 622.26 }
  }

  if (method === 'get' && path === '/analytics/conversion') {
    return { total_bookings: 40, paid_bookings: 28, ticketed_bookings: 22, conversion_rate: 70 }
  }

  if (method === 'get' && path === '/analytics/agent-performance') {
    return { agents: [
      { agent: 'agent@berlin.com', bookings: 14, revenue: 8120 },
      { agent: 'admin@flycentral.com', bookings: 10, revenue: 6400 },
    ] }
  }

  if (method === 'get' && path === '/analytics/destination-heatmap') {
    return { top_routes: [
      { route: 'FRA-JFK', origin: 'FRA', destination: 'JFK', booking_count: 9 },
      { route: 'IST-BER', origin: 'IST', destination: 'BER', booking_count: 7 },
      { route: 'FRA-DXB', origin: 'FRA', destination: 'DXB', booking_count: 6 },
    ] }
  }

  if (method === 'get' && path === '/analytics/admin') {
    return { by_tenant: [
      { tenant: 'Berlin Office', bookings: 24, revenue: 12200 },
      { tenant: 'Munich Office', bookings: 16, revenue: 8400 },
    ] }
  }

  if (method === 'get' && path === '/flights/catalog') {
    return {
      live_market_enabled: false,
      flight_count: 120,
      airlines: ['Lufthansa', 'Turkish Airlines', 'Emirates'],
    }
  }

  if (method === 'get' && path === '/flights/search') {
    const origin = params.get('origin') || 'FRA'
    const destination = params.get('destination') || 'JFK'
    return { results: demoFlights(origin, destination) }
  }

  if (method === 'get' && path === '/fare-watch') {
    return { results: DEMO_DB.fareWatch }
  }

  if (method === 'post' && path === '/fare-watch') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {})
    DEMO_DB.fareWatch.unshift({
      id: Date.now(),
      origin: body.origin,
      destination: body.destination,
      max_price: body.max_price,
      departure_date: body.departure_date,
      is_active: true,
    })
    return { ok: true }
  }

  if (method === 'post' && path === '/fare-watch/check') {
    return { triggered: 1 }
  }

  const fareDeleteMatch = path.match(/^\/fare-watch\/(\d+)$/)
  if (method === 'delete' && fareDeleteMatch) {
    const id = Number(fareDeleteMatch[1])
    DEMO_DB.fareWatch = DEMO_DB.fareWatch.filter(f => f.id !== id)
    return { ok: true }
  }

  if (method === 'get' && path === '/notifications') {
    return { results: DEMO_DB.notifications }
  }

  if (method === 'post' && path === '/webhook/airline') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {})
    DEMO_DB.notifications.unshift({
      id: Date.now(),
      title: body.event || 'webhook',
      message: body.message || 'Airline event received.',
      type: body.event || 'webhook',
      created_at: new Date().toISOString(),
      read_at: null,
    })
    return { ok: true }
  }

  if (method === 'get' && path === '/billing/invoices') {
    return { results: DEMO_DB.invoices }
  }

  if (method === 'post' && path.startsWith('/stripe/checkout/')) {
    return { checkout_url: null }
  }

  if (method === 'get' && path === '/admin/tenants') {
    return { results: [{ id: 1, name: 'Berlin Office', markup_percent: 12 }] }
  }

  if (method === 'get' && path === '/admin/users') {
    return { results: [{ id: 1, email: 'admin@flycentral.com', role: 'admin' }] }
  }

  if (method === 'get' && path === '/admin/audit') {
    return { results: [{ id: 1, action: 'demo-fallback', created_at: new Date().toISOString() }] }
  }

  if (method === 'get' && path === '/live-events') {
    return { results: [] }
  }

  if (method === 'post' && path === '/admin/billing/run') {
    return { ok: true, created_invoices: 1 }
  }

  if ((method === 'post' || method === 'put') && path.startsWith('/admin/tenants')) {
    return { ok: true }
  }

  return method === 'get' ? { results: [] } : { ok: true }
}

async function switchToNextBaseUrl() {
  const candidates = [...new Set(FALLBACK_BASE_URLS.map(normalizeBaseUrl).filter(Boolean))]
  if (candidates.length < 2) return false
  if (isSwitchingBaseUrl) return false
  isSwitchingBaseUrl = true
  try {
    const currentIndex = candidates.indexOf(activeBaseUrl)
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0
    const next = candidates[nextIndex]
    if (!next) return false
    setActiveApiBaseUrl(next)
    return true
  } finally {
    isSwitchingBaseUrl = false
  }
}

api.interceptors.request.use(cfg => {
  const token = useAuthStore.getState().token
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
    }

    const isNetworkError = !err.response
    const originalRequest = err.config || {}

    if (isNetworkError && !originalRequest.__retriedWithNextBaseUrl) {
      const switched = await switchToNextBaseUrl()
      if (switched) {
        originalRequest.__retriedWithNextBaseUrl = true
        originalRequest.baseURL = `${getActiveApiBaseUrl()}/api`
        return api.request(originalRequest)
      }
    }

    if (isNetworkError && DEMO_FALLBACK_ENABLED) {
      return mockResponse(originalRequest, getMockData(originalRequest), 200)
    }

    const msg = err.response?.data?.error || err.message || 'Unknown error'
    return Promise.reject(new Error(msg))
  }
)

export default api
