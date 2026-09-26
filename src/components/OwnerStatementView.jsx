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
        console.error('Error al cargar la propiedad:', error)
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
        }).sort((a, b) => new Date(b.date) - new Date(a.date))

        const filteredInc = allIncome.filter(i => {
          if (!i.date) return true
          return i.date >= startDate && i.date <= endDate
        }).sort((a, b) => new Date(b.date) - new Date(a.date))

        setExpenseList(filteredExp)
        setIncomeList(filteredInc)
      } catch (error) {
        console.error('Error al cargar transacciones:', error)
      } finally {
        setLoading(false)
      }
    }
    loadFinancialData()
  }, [propertyId, startDate, endDate])

  const totalIncomeUSD = incomeList.reduce((acc, curr) => acc + (Number(curr.amountUSD) || 0), 0)
  const totalExpenseUSD = expenseList.reduce((acc, curr) => acc + (Number(curr.amountUSD) || 0), 0)
  const netPeriodBalanceUSD = totalIncomeUSD - totalExpenseUSD

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

      const fileName = `Estado_Cuenta_${(property?.name || 'Propiedad').replace(/\s+/g, '_')}_${startDate}_a_${endDate}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Error al generar el PDF:', error)
      alert('No se pudo generar el PDF.')
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
              <h2 className="text-lg font-bold text-white">{property?.name || 'Estado de Cuenta'}</h2>
              <p className="text-xs text-slate-400">{ownerName ? `Propietario: ${ownerName}` : 'Flujo de caja de tu propiedad'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={generatingPdf}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> {generatingPdf ? 'Generando PDF...' : 'Descargar PDF'}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            >
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Fecha Inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Fecha Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:outline-none"
            />
          </div>
          <div className="text-xs text-slate-400 pb-2">
            Mostrando del <strong className="text-white">{startDate}</strong> al <strong className="text-white">{endDate}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/60 shadow-md">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ingresos del Periodo</span>
            <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            + $ {totalIncomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{incomeList.length} depósitos registrados</span>
        </div>

        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/60 shadow-md">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Gastos del Periodo</span>
            <ArrowUpRight className="h-5 w-5 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            - $ {totalExpenseUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{expenseList.length} recibos pagados</span>
        </div>

        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/60 shadow-md">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Balance Neto del Periodo</span>
            <Wallet className={`h-5 w-5 ${netPeriodBalanceUSD >= 0 ? 'text-amber-400' : 'text-rose-400'}`} />
          </div>
          <div className={`text-2xl font-black ${netPeriodBalanceUSD >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
            {netPeriodBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(netPeriodBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Ingresos menos gastos del periodo</span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-900/40 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4" /> Entradas / Aportes
          </h3>
          <span className="text-xs text-slate-400">{incomeList.length} entradas</span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-400 text-xs">Cargando...</div>
        ) : incomeList.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No hay depósitos en este periodo.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Concepto</th>
                  <th className="py-2.5 px-4">Monto ($ USD)</th>
                  <th className="py-2.5 px-4 text-center">Comprobante</th>
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
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Sin adjunto</span>
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
            <ArrowUpRight className="h-4 w-4" /> Salidas / Gastos y Servicios
          </h3>
          <span className="text-xs text-slate-400">{expenseList.length} salidas</span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-400 text-xs">Cargando...</div>
        ) : expenseList.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No hay gastos en este periodo.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Detalle</th>
                  <th className="py-2.5 px-4">Proveedor</th>
                  <th className="py-2.5 px-4">Monto ($ USD)</th>
                  <th className="py-2.5 px-4 text-center">Comprobante</th>
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
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Sin adjunto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plantilla blanca oculta, usada únicamente para generar el PDF */}
      <div className="fixed top-0 pointer-events-none" style={{ left: '-9999px' }}>
        <div ref={pdfTemplateRef} className="bg-white text-slate-900 w-200">
          <div className="p-6 border-b-2 border-emerald-600">
            <h1 className="text-xl font-bold">Fabrizio Property Management</h1>
            <p className="text-sm font-semibold">
              Estado de Cuenta: {property?.name} {ownerName ? `(Propietario: ${ownerName})` : ''}
            </p>
            <p className="text-xs text-slate-500">Periodo del {startDate} al {endDate}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Ingresos del Periodo</div>
                <div className="text-2xl font-black text-emerald-600">
                  + $ {totalIncomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Gastos del Periodo</div>
                <div className="text-2xl font-black text-rose-600">
                  - $ {totalExpenseUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Balance Neto</div>
                <div className={`text-2xl font-black ${netPeriodBalanceUSD >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {netPeriodBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(netPeriodBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-emerald-700">Entradas / Aportes</h3>
              </div>
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Fecha</th>
                    <th className="py-2.5 px-4">Concepto</th>
                    <th className="py-2.5 px-4">Monto ($ USD)</th>
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
                    <tr><td colSpan={3} className="py-4 px-4 text-center text-slate-400">No hay depósitos en este periodo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-rose-700">Salidas / Gastos y Servicios</h3>
              </div>
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Fecha</th>
                    <th className="py-2.5 px-4">Detalle</th>
                    <th className="py-2.5 px-4">Proveedor</th>
                    <th className="py-2.5 px-4">Monto ($ USD)</th>
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
                    <tr><td colSpan={4} className="py-4 px-4 text-center text-slate-400">No hay gastos en este periodo.</td></tr>
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
