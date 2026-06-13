import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSemester } from '../context/SemesterContext'
import Spinner from '../components/Spinner'

// Financial report for chapter meetings + national-org audits. Read-only,
// scoped to the semester being viewed. Print-to-PDF (browser print) and CSV
// export. Admin-only.

const fmt = (n) => `$${Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
const fmtDate = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function downloadCsv(filename, rows) {
  const body = rows.map((r) => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { chapterName, isAdmin } = useAuth()
  const { viewingSemester, viewingSemesterId } = useSemester()

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [data, setData]       = useState(null)

  const load = useCallback(async () => {
    if (!viewingSemesterId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const bySem = (q) => q.eq('semester_id', viewingSemesterId)
      const [accts, exps, incs, cols] = await Promise.all([
        bySem(supabase.from('budget_accounts').select('*')),
        bySem(supabase.from('expenses').select('*').order('date', { ascending: false })),
        bySem(supabase.from('income').select('*').order('date', { ascending: false })),
        bySem(supabase.from('dues_collections').select('id, name')),
      ])
      for (const r of [accts, exps, incs, cols]) if (r.error) throw r.error

      // Dues totals across this semester's collections.
      let duesExpected = 0, duesCollected = 0
      const colIds = (cols.data ?? []).map((c) => c.id)
      if (colIds.length) {
        const { data: md, error: e } = await supabase
          .from('member_dues').select('amount_owed, status')
          .in('dues_collection_id', colIds)
        if (e) throw e
        for (const d of md ?? []) {
          duesExpected += Number(d.amount_owed || 0)
          if (d.status === 'paid') duesCollected += Number(d.amount_owed || 0)
        }
      }

      setData({ accounts: accts.data ?? [], expenses: exps.data ?? [], income: incs.data ?? [], duesExpected, duesCollected })
    } catch (err) {
      setError(err?.message ?? 'Failed to build report.')
    } finally {
      setLoading(false)
    }
  }, [viewingSemesterId])

  useEffect(() => { load() }, [load])

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-xl mx-auto">
        <p className="gl-serif text-lg font-semibold text-gray-900 mb-1">Financial Reports</p>
        <p className="text-sm text-gray-500">Only a Treasurer or President can view reports.</p>
      </div>
    )
  }
  if (loading) return <Spinner />
  if (error)   return <p className="text-sm text-red-500 py-10 text-center">{error}</p>
  if (!data)   return <p className="text-sm text-gray-400 py-10 text-center">No semester data to report.</p>

  const { accounts, expenses, income, duesExpected, duesCollected } = data
  const tops = accounts.filter((a) => !a.parent_id)
  const totalBudget  = tops.reduce((s, a) => s + Number(a.total_budget), 0)
  const totalIncome  = income.reduce((s, i) => s + Number(i.amount), 0)
  const approved     = expenses.filter((e) => e.status === 'Approved')
  const totalSpent   = approved.reduce((s, e) => s + Number(e.amount), 0)
  const net          = totalIncome - totalSpent

  // spent per top-level account (count non-rejected, attributed via sub or top)
  const acctById = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const spentByTop = {}
  expenses.filter((e) => e.status !== 'Rejected' && e.budget_account_id).forEach((e) => {
    const a = acctById[e.budget_account_id]; if (!a) return
    const topId = a.parent_id ?? a.id
    spentByTop[topId] = (spentByTop[topId] || 0) + Number(e.amount)
  })

  function exportCsv() {
    const rows = [
      [`Greek Ledger — Financial Report`],
      [`Chapter`, chapterName || ''],
      [`Semester`, viewingSemester?.name || ''],
      [`Generated`, today()],
      [],
      [`SUMMARY`],
      [`Total Income`, totalIncome.toFixed(2)],
      [`Total Spent (approved)`, totalSpent.toFixed(2)],
      [`Net Cash Flow`, net.toFixed(2)],
      [`Total Budget`, totalBudget.toFixed(2)],
      [`Dues Expected`, duesExpected.toFixed(2)],
      [`Dues Collected`, duesCollected.toFixed(2)],
      [],
      [`BUDGET VS ACTUAL`],
      [`Account`, `Budget`, `Spent`, `Remaining`],
      ...tops.map((a) => [a.name, Number(a.total_budget).toFixed(2), (spentByTop[a.id] || 0).toFixed(2), (Number(a.total_budget) - (spentByTop[a.id] || 0)).toFixed(2)]),
      [],
      [`EXPENSES`],
      [`Date`, `Category`, `Description`, `Amount`, `Status`, `Submitted By`],
      ...expenses.map((e) => [e.date, e.category, e.description, Number(e.amount).toFixed(2), e.status, e.submitted_by]),
      [],
      [`INCOME`],
      [`Date`, `Category`, `Description`, `Amount`, `Recorded By`],
      ...income.map((i) => [i.date, i.category, i.description, Number(i.amount).toFixed(2), i.recorded_by]),
    ]
    const slug = `${(chapterName || 'chapter').replace(/[^a-z0-9]+/gi, '-')}-${(viewingSemester?.name || '').replace(/[^a-z0-9]+/gi, '-')}`.toLowerCase()
    downloadCsv(`greek-ledger-report-${slug}.csv`, rows)
  }

  const Card = ({ label, value, color }) => (
    <div className="rounded-lg p-4" style={{ backgroundColor: '#faf8f3', border: '1px solid #e9e2d3' }}>
      <p className="text-xs font-medium" style={{ color: '#8a8170' }}>{label}</p>
      <p className="gl-serif text-2xl font-semibold mt-0.5" style={{ color: color || '#1b2640' }}>{value}</p>
    </div>
  )

  return (
    <div className="max-w-4xl space-y-5">
      {/* Action bar — hidden when printing */}
      <div className="gl-no-print flex items-center justify-between">
        <p className="text-sm text-gray-500">Financial report for {viewingSemester?.name || 'this semester'}. Print to PDF or export CSV for meetings and audits.</p>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-4 py-2 rounded-lg text-sm font-semibold border transition hover:bg-gray-50" style={{ borderColor: '#1b2640', color: '#1b2640' }}>
            Export CSV
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: '#b08d4f', color: '#fff' }}>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* The printable report */}
      <div className="gl-report bg-white rounded-xl shadow-sm p-8 space-y-7">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-5" style={{ borderColor: '#e9e2d3' }}>
          <div>
            <h1 className="gl-serif text-3xl font-semibold" style={{ color: '#1b2640' }}>{chapterName || 'Chapter'}</h1>
            <p className="text-sm mt-1" style={{ color: '#8a8170' }}>Financial Report · {viewingSemester?.name || ''}</p>
          </div>
          <div className="text-right">
            <div className="gl-serif text-lg font-semibold" style={{ color: '#b08d4f' }}>Greek Ledger</div>
            <p className="text-xs mt-1" style={{ color: '#a99f8b' }}>Generated {today()}</p>
          </div>
        </div>

        {/* Summary */}
        <div>
          <p className="gl-eyebrow mb-3" style={{ color: '#b08d4f' }}>Summary</p>
          <div className="grid grid-cols-3 gap-3">
            <Card label="Total Income" value={fmt(totalIncome)} color="#15803d" />
            <Card label="Total Spent" value={fmt(totalSpent)} color="#b91c1c" />
            <Card label="Net Cash Flow" value={fmt(net)} color={net < 0 ? '#b91c1c' : '#1b2640'} />
            <Card label="Total Budget" value={fmt(totalBudget)} />
            <Card label="Dues Collected" value={fmt(duesCollected)} />
            <Card label="Dues Expected" value={fmt(duesExpected)} />
          </div>
        </div>

        {/* Budget vs actual */}
        <div>
          <p className="gl-eyebrow mb-3" style={{ color: '#b08d4f' }}>Budget vs. Actual</p>
          {tops.length === 0 ? <p className="text-sm text-gray-400">No budget accounts.</p> : (
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: '1px solid #e9e2d3' }}>
                {['Account', 'Budget', 'Spent', 'Remaining'].map((h, i) => (
                  <th key={h} className={`py-2 ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: '#8a8170', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {tops.map((a) => {
                  const sp = spentByTop[a.id] || 0
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f3efe6' }}>
                      <td className="py-2" style={{ color: '#1b2640' }}>{a.name}</td>
                      <td className="py-2 text-right" style={{ color: '#5b677f' }}>{fmt(a.total_budget)}</td>
                      <td className="py-2 text-right" style={{ color: '#5b677f' }}>{fmt(sp)}</td>
                      <td className="py-2 text-right font-semibold" style={{ color: Number(a.total_budget) - sp < 0 ? '#b91c1c' : '#1b2640' }}>{fmt(Number(a.total_budget) - sp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Expenses */}
        <div>
          <p className="gl-eyebrow mb-3" style={{ color: '#b08d4f' }}>Expenses ({expenses.length})</p>
          {expenses.length === 0 ? <p className="text-sm text-gray-400">No expenses recorded.</p> : (
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: '1px solid #e9e2d3' }}>
                {['Date', 'Category', 'Description', 'Amount', 'Status'].map((h, i) => (
                  <th key={h} className={`py-2 ${i >= 3 ? 'text-right' : 'text-left'}`} style={{ color: '#8a8170', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3efe6' }}>
                    <td className="py-2 whitespace-nowrap" style={{ color: '#8a8170' }}>{fmtDate(e.date)}</td>
                    <td className="py-2" style={{ color: '#1b2640' }}>{e.category}</td>
                    <td className="py-2" style={{ color: '#5b677f' }}>{e.description}</td>
                    <td className="py-2 text-right" style={{ color: '#1b2640' }}>{fmt(e.amount)}</td>
                    <td className="py-2 text-right" style={{ color: '#8a8170' }}>{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Income */}
        <div>
          <p className="gl-eyebrow mb-3" style={{ color: '#b08d4f' }}>Income ({income.length})</p>
          {income.length === 0 ? <p className="text-sm text-gray-400">No income recorded.</p> : (
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: '1px solid #e9e2d3' }}>
                {['Date', 'Category', 'Description', 'Amount'].map((h, i) => (
                  <th key={h} className={`py-2 ${i === 3 ? 'text-right' : 'text-left'}`} style={{ color: '#8a8170', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {income.map((i) => (
                  <tr key={i.id} style={{ borderBottom: '1px solid #f3efe6' }}>
                    <td className="py-2 whitespace-nowrap" style={{ color: '#8a8170' }}>{fmtDate(i.date)}</td>
                    <td className="py-2" style={{ color: '#1b2640' }}>{i.category}</td>
                    <td className="py-2" style={{ color: '#5b677f' }}>{i.description}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: '#15803d' }}>{fmt(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs pt-4 border-t" style={{ borderColor: '#e9e2d3', color: '#a99f8b' }}>
          Generated by Greek Ledger · greekledger.com · {today()}
        </p>
      </div>
    </div>
  )
}
