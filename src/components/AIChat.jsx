import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { MessageCircle, Send, X, Loader, Trash2 } from 'lucide-react'

const api = (path, opts) => axios({ url: `/api${path}`, ...opts }).then(r => r.data)

function ChatWindow({ onClose }) {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const qc = useQueryClient()

  const { data: sessions } = useQuery({ queryKey: ['ai-sessions'], queryFn: () => api('/ai/sessions') })

  const send = useMutation({
    mutationFn: () => api('/ai/chat', { method: 'POST', data: { session_id: sessionId, message: input, subject: 'Chat' } }),
    onSuccess: (data) => {
      setMessages(data.messages)
      setSessionId(data.session_id)
      setInput('')
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Fehler'),
  })

  const handleSend = () => {
    if (!input.trim()) return
    setLoading(true)
    send.mutate()
    setLoading(false)
  }

  const deleteSession = useMutation({
    mutationFn: (id) => api(`/ai/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries(['ai-sessions']); setSessionId(null); setMessages([]) },
  })

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border flex flex-col z-50 h-[600px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white flex justify-between items-center rounded-t-2xl">
        <h2 className="font-bold flex items-center gap-2"><MessageCircle size={18}/> FlyCentral AI</h2>
        <button onClick={onClose}><X size={20}/></button>
      </div>

      {/* Session selector */}
      {sessions?.sessions?.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-b text-xs">
          <select
            value={sessionId || ''}
            onChange={(e) => {
              const s = e.target.value
              setSessionId(s)
              const sess = sessions.sessions.find(ss => ss.id === s)
              if (sess) api(`/ai/sessions/${s}`).then(d => setMessages(d.messages))
            }}
            className="w-full border rounded px-2 py-1 text-xs">
            <option value="">– Neue Session –</option>
            {sessions.sessions.map(s => <option key={s.id} value={s.id}>{s.subject || 'Chat'} ({new Date(s.created_at).toLocaleDateString('de-DE')})</option>)}
          </select>
          {sessionId && (
            <button
              onClick={() => deleteSession.mutate(sessionId)}
              className="mt-1 text-red-500 flex items-center gap-1 text-xs hover:bg-red-50 px-2 py-1 rounded w-full">
              <Trash2 size={12}/> Session löschen
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p className="mb-2">👋 Willkommen!</p>
            <p>Fragen Sie nach:</p>
            <ul className="text-xs mt-2">
              <li>💰 Kosten & Provisionen</li>
              <li>📝 Visa-Info</li>
              <li>✈️ Flugbuchungen</li>
              <li>👥 Gruppenbuchungen</li>
              <li>🎫 Kunden & Tickets</li>
            </ul>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border text-gray-800'
                }`}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <Loader size={14} className="animate-spin"/> AI denkt nach…
          </div>
        )}
        <div ref={messagesEndRef}/>
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2 rounded-b-2xl bg-white">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Frage stellen…"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Send size={18}/>
        </button>
      </div>
    </div>
  )
}

export default function AIChat() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && <ChatWindow onClose={() => setOpen(false)}/>}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center z-40 transition-transform hover:scale-110">
          <MessageCircle size={28}/>
        </button>
      )}
    </>
  )
}
