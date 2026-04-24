import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Card from '../components/Card'
import Btn from '../components/Btn'
import { Download, CreditCard } from 'lucide-react'

function fmtDt(s) {
  return s ? new Date(s).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–'
}

const STATUS_COLOR = {
  paid:    'bg-green-100  text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100    text-red-700',
}

function exportCsv(rows, fields, filename) {
  const header = fields.join(',')
  const body   = rows.map(r => fields.map(f => JSON.stringify(r[f] ?? '')).join(',')).join('\n')
  const blob   = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function BillingPage() {
  const { data: invoices, isLoading: invLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn:  () => api.get('/billing/invoices').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard size={22} className="text-teal-600" />
        <h1 className="text-xl font-bold text-slate-800">Billing & Rechnungen</h1>
      </div>

      {/* Invoices */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Rechnungen ({invoices?.results?.length ?? 0})</h2>
          <Btn variant="secondary" size="sm" disabled={!invoices?.results?.length}
            onClick={() => exportCsv(invoices.results, ['id','period','total_amount','status','due_date'], 'invoices.csv')}>
            <Download size={13} /> CSV Export
          </Btn>
        </div>

        {invLoading && <p className="text-slate-500 text-sm">Lade…</p>}
        {!invLoading && !invoices?.results?.length && (
          <Card><p className="text-slate-500 text-sm">Noch keine Rechnungen</p></Card>
        )}
        {invoices?.results?.map(inv => (
          <Card key={inv.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono font-bold text-slate-800">{inv.id}</p>
                <p className="text-sm text-slate-600">Periode: {inv.period}</p>
                <p className="text-sm text-slate-600">Fällig: {fmtDt(inv.due_date)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-teal-700">{parseFloat(inv.total_amount).toFixed(2)} €</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                  {inv.status}
                </span>
              </div>
            </div>
            {(() => {
              const ids = Array.isArray(inv.booking_ids)
                ? inv.booking_ids
                : JSON.parse(inv.booking_ids || '[]')
              return ids.length > 0
                ? <p className="text-xs text-slate-400 mt-2">Buchungen: {ids.join(', ')}</p>
                : null
            })()}
          </Card>
        ))}
      </div>
    </div>
  )
}
