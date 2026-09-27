import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'
import {
  ArrowDownLeft, ArrowUpRight, Wallet, FileText, ExternalLink, Printer, LogOut
} from 'lucide-react'

export default function OwnerStatementView({ propertyId, onLogout }) {
  const [property, setProperty] = useState(null)
  const [ownerName, setOwnerName] = useState('')
  const [providers, setProviders] = useState([])

  const today = new Date().toISOString().split('T')[0]
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)

  const [incomeList, setIncomeList] = useState([])
  const [expenseList, setExpenseList] = useState([])
  const [openingBalanceUSD, setOpeningBalanceUSD] = useState(0)
  const [loading, setLoading] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const pdfTemplateRef = useRef(null)

  useEffect(() => {
    const fetchPropertyInfo = async () => {
      if (!propertyId) return
      try {
        const propSnap = await getDoc(doc(db, 'properties', propertyId))
        if (propSnap.exists()) {
          const data = { id: propSnap.id, ...propSnap.data() }
          setProperty(data)
          if (data.clientId) {
            const clientSnap = await getDoc(doc(db, 'clients', data.clientId))
            if (clientSnap.exists()) {
              const c = clientSnap.data()
              setOwnerName(`${c.firstName || ''} ${c.lastName || ''}`.trim())
            }
          }
        }
        const provSnap = await getDocs(collection(db, 'providers'))
        setProviders(provSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (error) {
        console.error('Error loading property:', error)
      }
    }
    fetchPropertyInfo()
  }, [propertyId])

  useEffect(() => {
    const loadFinancialData = async () => {
      if (!propertyId) return
      setLoading(true)
      try {
        const snapExpenses = await getDocs(query(collection(db, 'expenses')))
        const allExpenses = snapExpenses.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(e => e.propertyId === propertyId)

        const snapIncome = await getDocs(query(collection(db, 'incomes')))
        const allIncome = snapIncome.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(i => i.propertyId === propertyId)

        const filteredExp = allExpenses.filter(e => {
          if (!e.date) return true
          return e.date >= startDate && e.date <= endDate
        }).sort((a, b) => new Date(a.date) - new Date(b.date))

        const filteredInc = allIncome.filter(i => {
          if (!i.date) return true
          return i.date >= startDate && i.date <= endDate
        }).sort((a, b) => new Date(a.date) - new Date(b.date))

        setExpenseList(filteredExp)
        setIncomeList(filteredInc)

        const priorIncomeUSD = allIncome
          .filter(i => i.date && i.date < startDate)
          .reduce((acc, curr) => acc + (Number(curr.amountUSD) || 0), 0)
        const priorExpenseUSD = allExpenses
          .filter(e => e.date && e.date < startDate)
          .reduce((acc, curr) => acc + (Number(curr.amountUSD) || 0), 0)
        setOpeningBalanceUSD(priorIncomeUSD - priorExpenseUSD)
      } catch (error) {
        console.error('Error loading transactions:', error)
      } finally {
        setLoading(false)
      }
    }
    loadFinancialData()
  }, [propertyId, startDate, endDate])

  const totalIncomeUSD = incomeList.reduce((acc, curr) => acc + (Number(curr.amountUSD) || 0), 0)
  const totalExpenseUSD = expenseList.reduce((acc, curr) => acc + (Number(curr.amountUSD) || 0), 0)
  const netPeriodBalanceUSD = totalIncomeUSD - totalExpenseUSD
  const accumulatedBalanceUSD = openingBalanceUSD + netPeriodBalanceUSD

  const handleDownloadPDF = async () => {
    if (!pdfTemplateRef.current) return
    setGeneratingPdf(true)
    try {
      const canvas = await html2canvas(pdfTemplateRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const fileName = `Account_Statement_${(property?.name || 'Property').replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Could not generate the PDF.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-8">
      <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{property?.name || 'Account Statement'}</h2>
              <p className="text-xs text-slate-400">{ownerName ? `Owner: ${ownerName}` : 'Property cash flow'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={generatingPdf}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> {generatingPdf ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            >
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:outline-none"
            />
          </div>
          <div className="text-xs text-slate-400 pb-2">
            Showing from <strong className="text-white">{startDate}</strong> to <strong className="text-white">{endDate}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Opening Balance</span>
            <Wallet className={`h-4 w-4 shrink-0 ${openingBalanceUSD >= 0 ? 'text-slate-300' : 'text-rose-400'}`} />
          </div>
          <div className={`text-lg font-black whitespace-nowrap ${openingBalanceUSD >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
            {openingBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(openingBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Balance before {startDate}</span>
        </div>

        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Income for the Period</span>
            <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-400" />
          </div>
          <div className="text-lg font-black whitespace-nowrap text-emerald-400">
            + $ {totalIncomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{incomeList.length} deposits recorded</span>
        </div>

        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Expenses for the Period</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-rose-400" />
          </div>
          <div className="text-lg font-black whitespace-nowrap text-rose-400">
            - $ {totalExpenseUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{expenseList.length} paid receipts</span>
        </div>

        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Net Balance for the Period</span>
            <Wallet className={`h-4 w-4 shrink-0 ${netPeriodBalanceUSD >= 0 ? 'text-amber-400' : 'text-rose-400'}`} />
          </div>
          <div className={`text-lg font-black whitespace-nowrap ${netPeriodBalanceUSD >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
            {netPeriodBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(netPeriodBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Income minus expenses for the period</span>
        </div>

        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Accumulated Balance</span>
            <Wallet className={`h-4 w-4 shrink-0 ${accumulatedBalanceUSD >= 0 ? 'text-cyan-400' : 'text-rose-400'}`} />
          </div>
          <div className={`text-lg font-black whitespace-nowrap ${accumulatedBalanceUSD >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
            {accumulatedBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(accumulatedBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Balance carried forward through {endDate}</span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-900/40 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4" /> Income / Contributions
          </h3>
          <span className="text-xs text-slate-400">{incomeList.length} entries</span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-400 text-xs">Loading...</div>
        ) : incomeList.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No deposits for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Amount ($ USD)</th>
                  <th className="py-2.5 px-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {incomeList.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-700/30">
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-400">{inc.date || 'N/A'}</td>
                    <td className="py-2.5 px-4 font-semibold text-white">{inc.description}</td>
                    <td className="py-2.5 px-4 font-bold text-emerald-400">
                      + $ {Number(inc.amountUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {inc.receiptUrl ? (
                        <a href={inc.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center justify-center gap-1">
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 text-[10px]">No attachment</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-900/40 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" /> Expenses &amp; Services
          </h3>
          <span className="text-xs text-slate-400">{expenseList.length} expenses</span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-400 text-xs">Loading...</div>
        ) : expenseList.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No expenses for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4">Provider</th>
                  <th className="py-2.5 px-4">Amount ($ USD)</th>
                  <th className="py-2.5 px-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {expenseList.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-700/30">
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-400">{exp.date || 'N/A'}</td>
                    <td className="py-2.5 px-4 font-semibold text-white">{exp.description}</td>
                    <td className="py-2.5 px-4 text-slate-300">{providers.find(pr => pr.id === exp.providerId)?.name || 'N/A'}</td>
                    <td className="py-2.5 px-4 font-bold text-rose-400">
                      - $ {Number(exp.amountUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {exp.receiptUrl ? (
                        <a href={exp.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center justify-center gap-1">
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 text-[10px]">No attachment</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden white template used only to generate the PDF */}
      <div className="fixed top-0 pointer-events-none" style={{ left: '-9999px' }}>
        <div ref={pdfTemplateRef} className="bg-white text-slate-900 w-200">
          <div className="p-6 border-b-2 border-emerald-600">
            <h1 className="text-xl font-bold">Fabrizio Property Management</h1>
            <p className="text-sm font-semibold">
              Account Statement: {property?.name} {ownerName ? `(Owner: ${ownerName})` : ''}
            </p>
            <p className="text-xs text-slate-500">Period: {startDate} to {endDate}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">Opening Balance</div>
                <div className={`text-base font-black whitespace-nowrap ${openingBalanceUSD >= 0 ? 'text-slate-700' : 'text-rose-600'}`}>
                  {openingBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(openingBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">Income for the Period</div>
                <div className="text-base font-black whitespace-nowrap text-emerald-600">
                  + $ {totalIncomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">Expenses for the Period</div>
                <div className="text-base font-black whitespace-nowrap text-rose-600">
                  - $ {totalExpenseUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">Net Balance</div>
                <div className={`text-base font-black whitespace-nowrap ${netPeriodBalanceUSD >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {netPeriodBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(netPeriodBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">Accumulated Balance</div>
                <div className={`text-base font-black whitespace-nowrap ${accumulatedBalanceUSD >= 0 ? 'text-cyan-600' : 'text-rose-600'}`}>
                  {accumulatedBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(accumulatedBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-emerald-700">Income / Contributions</h3>
              </div>
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Amount ($ USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {incomeList.map((inc) => (
                    <tr key={inc.id}>
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">{inc.date || 'N/A'}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{inc.description}</td>
                      <td className="py-2.5 px-4 font-bold text-emerald-700">
                        + $ {Number(inc.amountUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {incomeList.length === 0 && (
                    <tr><td colSpan={3} className="py-4 px-4 text-center text-slate-400">No deposits for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-rose-700">Expenses &amp; Services</h3>
              </div>
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Details</th>
                    <th className="py-2.5 px-4">Provider</th>
                    <th className="py-2.5 px-4">Amount ($ USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {expenseList.map((exp) => (
                    <tr key={exp.id}>
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">{exp.date || 'N/A'}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{exp.description}</td>
                      <td className="py-2.5 px-4 text-slate-600">{providers.find(pr => pr.id === exp.providerId)?.name || 'N/A'}</td>
                      <td className="py-2.5 px-4 font-bold text-rose-700">
                        - $ {Number(exp.amountUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {expenseList.length === 0 && (
                    <tr><td colSpan={4} className="py-4 px-4 text-center text-slate-400">No expenses for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
