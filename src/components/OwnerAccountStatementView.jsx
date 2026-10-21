import { useEffect, useMemo, useRef, useState } from 'react'
import SharedAccountPdfTemplate, { exportElementToPdf } from './SharedAccountPdf'
import { db } from '../firebase/config'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import DateRangePicker from './DateRangePicker'
import { getCostaRicaDate, getCostaRicaMonthStart } from '../utils/formValues'
import { computeAccountStatement } from '../utils/sharedAccounts'
import { ArrowDownLeft, ArrowUpRight, ExternalLink, FileText, Home, Printer, Wallet } from 'lucide-react'

const money = value => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = value => `${value >= 0 ? '+' : '-'} $ ${money(Math.abs(value))}`

function getReceipts(item) {
  if (item.receipts?.length) return item.receipts
  const urls = item.receiptUrls?.length ? item.receiptUrls : (item.receiptUrl ? [item.receiptUrl] : [])
  return urls.map((url, idx) => ({ url, name: `File ${idx + 1}` }))
}

function Receipts({ item }) {
  const receipts = getReceipts(item)
  if (!receipts.length) return <span className="text-[10px] text-slate-500">No attachment</span>
  return (
    <div className="flex flex-col items-end gap-0.5">
      {receipts.map((r, idx) => (
        <a key={idx} href={r.url} target="_blank" rel="noopener noreferrer" title={r.name} className="flex items-center gap-1 text-emerald-400 hover:underline">
          {r.name.length > 16 ? `${r.name.slice(0, 14)}…` : r.name} <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  )
}

export default function OwnerAccountStatementView({ accountId }) {
  const [account, setAccount] = useState(null)
  const [propertyNames, setPropertyNames] = useState({})
  const [providers, setProviders] = useState([])
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const pdfRef = useRef(null)
  const [accountIncomes, setAccountIncomes] = useState([])
  const [houseIncomes, setHouseIncomes] = useState([])
  const [expenses, setExpenses] = useState([])
  const [startDate, setStartDate] = useState(getCostaRicaMonthStart())
  const [endDate, setEndDate] = useState(getCostaRicaDate())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const accountSnap = await getDoc(doc(db, 'sharedAccounts', accountId))
        if (!accountSnap.exists()) throw new Error('Account not found')
        const loaded = { id: accountSnap.id, ...accountSnap.data() }
        const ids = loaded.propertyIds || []
        const byProperty = name => Promise.all(ids.map(id => getDocs(query(collection(db, name), where('propertyId', '==', id)))))
        const toList = snaps => snaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
        const [expenseSnaps, incomeSnaps, accountIncomeSnap, directorySnaps, providerSnap] = await Promise.all([
          byProperty('expenses'),
          byProperty('incomes'),
          getDocs(query(collection(db, 'sharedAccountIncomes'), where('accountId', '==', accountId))),
          Promise.all(ids.map(id => getDoc(doc(db, 'propertyStatementDirectory', id)))),
          getDocs(collection(db, 'providerDirectory')).catch(() => null),
        ])
        if (cancelled) return
        setProviders(providerSnap ? providerSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [])
        setAccount(loaded)
        setExpenses(toList(expenseSnaps))
        setHouseIncomes(toList(incomeSnaps))
        setAccountIncomes(accountIncomeSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setPropertyNames(Object.fromEntries(directorySnaps.map(snap => [snap.id, snap.data()?.name || 'Property'])))
        setError('')
      } catch (err) {
        console.error('Error loading shared account:', err)
        if (!cancelled) setError('The account statement could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [accountId])

  const statement = useMemo(() => account
    ? computeAccountStatement({ account, incomes: accountIncomes, houseIncomes, expenses, startDate, endDate })
    : null, [account, accountIncomes, houseIncomes, expenses, startDate, endDate])

  if (!accountId) return <p className="p-8 text-center text-sm text-slate-400">No account selected.</p>
  if (loading) return <p className="p-8 text-center text-sm text-slate-400">Loading statement…</p>
  if (error || !account || !statement) return <p className="p-8 text-center text-sm text-red-300">{error || 'Account not available.'}</p>

  const nameOf = id => propertyNames[id] || 'Property'
  const providerName = id => providers.find(p => p.id === id)?.name || 'N/A'
  const handleDownloadPdf = async () => {
    if (!pdfRef.current) return
    setGeneratingPdf(true)
    try {
      await exportElementToPdf(pdfRef.current, `Account_Statement_${account.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`)
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('Could not generate the PDF.')
    } finally {
      setGeneratingPdf(false)
    }
  }
  const cards = [
    ['Opening Balance', statement.openingBalanceUSD, 'text-slate-100', `Balance before ${startDate}`],
    ['Income for the Period', statement.totalIncomeUSD, 'text-emerald-400', `${statement.periodIncomes.length} deposits recorded`],
    ['Expenses for the Period', -statement.totalExpenseUSD, 'text-rose-400', 'All properties in this account'],
    ['Net Balance for the Period', statement.netPeriodBalanceUSD, statement.netPeriodBalanceUSD >= 0 ? 'text-amber-400' : 'text-rose-400', 'Income minus expenses'],
    ['Accumulated Balance', statement.accumulatedBalanceUSD, statement.accumulatedBalanceUSD >= 0 ? 'text-cyan-400' : 'text-rose-400', `Balance carried forward through ${endDate}`],
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400"><FileText className="h-6 w-6" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">{account.name}</h2>
              <p className="text-xs text-slate-400">Shared account · {account.propertyIds.map(nameOf).join(' + ')}</p>
            </div>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg transition-all hover:bg-emerald-400 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> {generatingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
        <SharedAccountPdfTemplate
          ref={pdfRef}
          account={account}
          statement={statement}
          nameOf={nameOf}
          providerName={providerName}
          startDate={startDate}
          endDate={endDate}
        />
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-300">Date Range</label>
            <DateRangePicker locale="en" startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          </div>
          <div className="pb-2 text-xs text-slate-400">
            Showing from <strong className="text-white">{startDate}</strong> to <strong className="text-white">{endDate}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, value, color, note]) => (
          <div key={label} className="min-w-0 rounded-2xl border border-slate-700/60 bg-slate-800 p-4 text-center shadow-md">
            <div className="mb-2 flex h-9 items-center justify-center gap-1.5 text-slate-400">
              <Wallet className="h-4 w-4 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
            </div>
            <div className={`whitespace-nowrap text-lg font-black ${color}`}>{signed(value)}</div>
            <span className="mt-1 block text-[11px] text-slate-400">{note}</span>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900/40 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-400"><ArrowDownLeft className="h-4 w-4" /> Income / Contributions</h3>
          <span className="text-xs text-slate-400">{statement.periodIncomes.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 uppercase tracking-wider text-slate-400">
                <th className="p-3">Date</th><th className="p-3">Source</th><th className="p-3">Description</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {statement.periodIncomes.map(income => (
                <tr key={income.id}>
                  <td className="p-3 text-slate-300">{income.date || '—'}</td>
                  <td className="p-3 text-slate-300">{income.accountId ? 'Shared account' : nameOf(income.propertyId)}</td>
                  <td className="p-3 text-white">{income.description}</td>
                  <td className="p-3 text-right font-semibold text-emerald-400">+ $ {money(income.amountUSD)}</td>
                  <td className="p-3 text-right"><Receipts item={income} /></td>
                </tr>
              ))}
              {statement.periodIncomes.length === 0 && <tr><td colSpan={5} className="p-5 text-center text-slate-500">No income for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900/40 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-rose-400"><ArrowUpRight className="h-4 w-4" /> Expenses by Property</h3>
        </div>
        {statement.expensesByProperty.map(group => (
          <div key={group.propertyId} className="border-b border-slate-700 last:border-b-0">
            <div className="flex items-center justify-between bg-slate-900/50 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs font-bold text-white"><Home className="h-3.5 w-3.5 text-amber-300" /> {nameOf(group.propertyId)}</span>
              <span className="text-xs font-bold text-rose-400">- $ {money(group.totalUSD)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <tbody className="divide-y divide-slate-700/60">
                  {group.items.map(expense => (
                    <tr key={expense.id}>
                      <td className="w-28 px-4 py-2 text-slate-400">{expense.date || '—'}</td>
                      <td className="px-4 py-2 text-slate-200">{expense.description || 'Expense'}</td>
                      <td className="px-4 py-2 text-right text-rose-400">- $ {money(expense.amountUSD)}</td>
                      <td className="px-4 py-2 text-right"><Receipts item={expense} /></td>
                    </tr>
                  ))}
                  {group.items.length === 0 && <tr><td className="px-4 py-3 text-slate-500">No expenses for this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-slate-700 bg-slate-900/70 px-4 py-3 text-xs font-bold">
          <span className="text-slate-300">Total expenses</span>
          <span className="text-rose-400">- $ {money(statement.totalExpenseUSD)}</span>
        </div>
      </section>
    </div>
  )
}
