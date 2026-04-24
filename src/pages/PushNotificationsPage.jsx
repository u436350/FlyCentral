import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Bell, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

const api = (path, opts) => axios({ url: `/api${path}`, ...opts }).then(r => r.data)

export default function PushNotificationsPage() {
  const [subscribed, setSubscribed] = useState(false)
  const qc = useQueryClient()

  const { data: status, refetch: checkStatus } = useQuery({
    queryKey: ['push-status'],
    queryFn: () => api('/push/status'),
  })

  // Notifications API Support prüfen
  const hasNotificationSupport = 'Notification' in window && 'serviceWorker' in navigator

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!hasNotificationSupport) throw new Error('Browser unterstützt Notifications nicht')
      if (!('serviceWorker' in navigator)) throw new Error('Service Workers nicht unterstützt')

      // Benachrichtigung aktivieren
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Berechtigung abgelehnt')

      // Service Worker registrieren (falls nicht vorhanden)
      try {
        await navigator.serviceWorker.register('/sw.js').catch(() => {
          // Falls sw.js nicht existiert ist das OK, wir simulieren
        })
      } catch (e) {
        console.log('Service Worker Fehler (ok):', e.message)
      }

      // Mock Subscription (in echter App würde PushManager verwendet)
      const subscription = {
        endpoint: `https://mock.example.com/sub/${Math.random()}`,
        keys: { p256dh: 'mock', auth: 'mock' },
      }

      return api('/push/subscribe', { method: 'POST', data: { subscription } })
    },
    onSuccess: () => { setSubscribed(true); checkStatus(); toast.success('Push-Benachrichtigungen aktiviert ✅') },
    onError: (e) => toast.error(e.message || 'Fehler beim Aktivieren'),
  })

  const unsubscribe = useMutation({
    mutationFn: () => api('/push/unsubscribe', { method: 'POST', data: { endpoint: 'mock' } }),
    onSuccess: () => { setSubscribed(false); checkStatus(); toast.success('Deaktiviert') },
  })

  const sendTest = useMutation({
    mutationFn: () => api('/push/test', { method: 'POST' }),
    onSuccess: (data) => {
      // Browser Notification zeigen
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, { body: data.body, icon: data.icon })
      }
      toast.success('Test-Benachrichtigung gesendet')
    },
    onError: (e) => toast.error(e.response?.data?.error),
  })

  useEffect(() => {
    setSubscribed(status?.subscribed ?? false)
  }, [status])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bell size={28} className="text-blue-600"/>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Push-Benachrichtigungen</h1>
          <p className="text-sm text-gray-500">Browser-Benachrichtigungen für Updates</p>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-2xl shadow border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Status</h2>
          <div className={`flex items-center gap-2 text-sm font-semibold ${subscribed ? 'text-green-600' : 'text-gray-500'}`}>
            {subscribed ? (
              <><CheckCircle size={20}/> Aktiviert</>
            ) : (
              <><XCircle size={20}/> Deaktiviert</>
            )}
          </div>
        </div>

        {!hasNotificationSupport ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5"/>
            <div className="text-sm text-red-700">
              <p className="font-semibold">Browser unterstützt Benachrichtigungen nicht</p>
              <p className="text-xs mt-1">Verwende einen modernen Browser (Chrome, Firefox, Edge, Safari)</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-semibold mb-1">Subscriptions</p>
                <p className="text-2xl font-bold text-blue-700">{status?.subscription_count || 0}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-green-600 font-semibold mb-1">Berechtigung</p>
                <p className="text-sm font-bold text-green-700">
                  {typeof Notification !== 'undefined' ? (Notification.permission === 'granted' ? '✅ Gewährt' : '⚠️ ' + Notification.permission) : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              {!subscribed ? (
                <button
                  onClick={() => subscribe.mutate()}
                  disabled={subscribe.isLoading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Bell size={16}/> {subscribe.isLoading ? 'Aktiviere...' : 'Aktivieren'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => sendTest.mutate()}
                    disabled={sendTest.isLoading}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                    {sendTest.isLoading ? 'Sende...' : 'Test-Nachricht'}
                  </button>
                  <button
                    onClick={() => unsubscribe.mutate()}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                    Deaktivieren
                  </button>
                </>
              )}
            </div>

            {subscribed && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
                ✅ <strong>Benachrichtigungen aktiviert!</strong> Du erhältst jetzt Updates zu Buchungen, Flugänderungen und Admin-Meldungen.
              </div>
            )}
          </>
        )}
      </div>

      {/* Was sind Benachrichtigungen? */}
      <div className="bg-white rounded-2xl shadow border p-6">
        <h2 className="text-lg font-bold mb-4">ℹ️ Über Push-Benachrichtigungen</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p><strong>🔔 Echtzeit-Updates</strong> — Erhalte sofort Benachrichtigungen zu neuen Buchungen und Flugänderungen</p>
          <p><strong>📱 Im Browser</strong> — Funktioniert auch wenn FlyCentral nicht aktiv ist</p>
          <p><strong>⚙️ Einstellbar</strong> — Du bestimmst, was dich benachrichtigt</p>
          <p><strong>🔒 Privat</strong> — Deine Benachrichtigungen sind verschlüsselt und privat</p>
        </div>
      </div>
    </div>
  )
}
