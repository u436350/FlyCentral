import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const STORAGE_KEY = 'flycentral-api-base-url'

const FALLBACK_BASE_URLS = [
  import.meta.env.VITE_API_URL,
  'https://flycentral-backend.onrender.com',
  'https://flycentral-api.onrender.com',
].filter(Boolean)

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/$/, '')
}

let activeBaseUrl = normalizeBaseUrl(localStorage.getItem(STORAGE_KEY) || FALLBACK_BASE_URLS[0] || '')

export function getActiveApiBaseUrl() {
  return activeBaseUrl
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

async function switchToNextBaseUrl() {
  if (isSwitchingBaseUrl) return false
  isSwitchingBaseUrl = true
  try {
    const candidates = [...new Set(FALLBACK_BASE_URLS.map(normalizeBaseUrl).filter(Boolean))]
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

    const msg = err.response?.data?.error || err.message || 'Unknown error'
    return Promise.reject(new Error(msg))
  }
)

export default api
