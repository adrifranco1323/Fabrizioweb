import { useState, useEffect, useRef } from 'react'
import { db, storage } from '../firebase/config'
import { collection, getDocs, query, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'
import { 
  Building2, ArrowDownLeft, ArrowUpRight, Wallet, 
  FileText, ExternalLink, Edit2, Trash2, X, Check, Printer, Upload, Calendar, Receipt
} from 'lucide-react'

export default function Statements() {
  const [properties, setProperties] = useState([])
  const [clients, setClients] = useState({})
  const [providers, setProviders] = useState([])
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  
  // Filtros de fecha (Por defecto: mes actual)
  const today = new Date().toISOString().split('T')[0]
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  
  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)

  // Datos
  const [incomeList, setIncomeList] = useState([])
  const [expenseList, setExpenseList] = useState([])
  const [openingBalanceUSD, setOpeningBalanceUSD] = useState(0)
  const [loading, setLoading] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const pdfTemplateRef = useRef(null)

  // Estados para Edición (Modal Completo)
  const [editingItem, setEditingItem] = useState(null)
  const [editFiles, setEditFiles] = useState([])
  const [removedReceipts, setRemovedReceipts] = useState([])
  const [editLoading, setEditLoading] = useState(false)

  // Deriva la lista de comprobantes (nombre, url, ruta en Storage) soportando registros antiguos
  const getReceipts = (item) => {
    if (item.receipts?.length) return item.receipts
    const urls = item.receiptUrls?.length ? item.receiptUrls : (item.receiptUrl ? [item.receiptUrl] : [])
    return urls.map((url, idx) => {
      let path = ''
      let name = `File ${idx + 1}`
      const match = url.match(/\/o\/([^?]+)/)
      if (match) {
        path = decodeURIComponent(match[1])
        const base = path.split('/').pop()
        const underscoreIdx = base.indexOf('_')
        name = underscoreIdx >= 0 ? base.slice(underscoreIdx + 1) : base
      }
      return { url, name, path }
    })
  }

  const fetchData = async () => {
    try {
      // 1. Cargar Clientes y guardarlos en un diccionario por ID para búsqueda rápida
      const clientSnap = await getDocs(collection(db, 'clients'))
      const clientMap = {}
      clientSnap.docs.forEach(doc => {
        const data = doc.data()
        clientMap[doc.id] = `${data.firstName || ''} ${data.lastName || ''}`.trim()
      })
      setClients(clientMap)

      // 2. Cargar Propiedades
      const propSnap = await getDocs(collection(db, 'properties'))
      const propList = propSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      propList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }))
      setProperties(propList)

      // 3. Cargar Proveedores
      try {
        const provSnap = await getDocs(collection(db, 'providers'))
        const provList = provSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        provList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }))
        setProviders(provList)
      } catch (e) {
        console.log('No providers collection yet')
      }
    } catch (error) {
      console.error('Error al cargar datos:', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const loadFinancialData = async () => {
    if (!selectedPropertyId) {
      setExpenseList([])
      setIncomeList([])
      setOpeningBalanceUSD(0)
      return
    }
    setLoading(true)
    try {
      // 1. Obtener todos los gastos de la propiedad
      const snapExpenses = await getDocs(query(collection(db, 'expenses')))
      const allExpenses = snapExpenses.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => e.propertyId === selectedPropertyId)

      // 2. Obtener todos los ingresos de la propiedad
      const snapIncome = await getDocs(query(collection(db, 'incomes')))
      const allIncome = snapIncome.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(i => i.propertyId === selectedPropertyId)

      // 3. FILTRAR MOVIMIENTOS DEL PERIODO (Entre startDate y endDate)
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

      // 4. Saldo acumulado: movimientos anteriores al periodo + balance neto del periodo
      const priorIncomeUSD = allIncome
        .filter(i => i.date && i.date < startDate)
        .reduce((acc, curr) => acc + (Number(curr.amountUSD) || 0), 0)
      const priorExpenseUSD = allExpenses
        .filter(e => e.date && e.date < startDate)
        .reduce((acc, curr) => acc + (Number(curr.amountUSD) || 0), 0)
      setOpeningBalanceUSD(priorIncomeUSD - priorExpenseUSD)

    } catch (error) {
      console.error('Error al cargar transacciones:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFinancialData()
  }, [selectedPropertyId, startDate, endDate, properties])

  // Eliminar Movimiento
  const handleDelete = async (id, type) => {
    const collectionName = type === 'income' ? 'incomes' : 'expenses'
    if (confirm(`Are you sure you want to delete this ${type === 'income' ? 'income' : 'expense'}?`)) {
      try {
        await deleteDoc(doc(db, collectionName, id))
        loadFinancialData()
      } catch (error) {
        console.error('Error al eliminar:', error)
        alert('The record could not be deleted.')
      }
    }
  }

  // Guardar Edición Completa con todos los campos
  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editingItem) return

    setEditLoading(true)
    try {
      // Eliminar en Storage los archivos que el usuario quitó
      for (const r of removedReceipts) {
        if (r.path) {
          try {
            await deleteObject(ref(storage, r.path))
          } catch (err) {
            console.error('No se pudo eliminar el archivo de Storage:', err)
          }
        }
      }

      const uploadedReceipts = []
      if (editFiles.length) {
        const folder = editingItem.type === 'income' ? 'incomes' : 'expenses'
        for (const f of editFiles) {
          const path = `${folder}/${Date.now()}_${f.name}`
          const fileRef = ref(storage, path)
          await uploadBytes(fileRef, f)
          const url = await getDownloadURL(fileRef)
          uploadedReceipts.push({ url, name: f.name, path })
        }
      }

      const receipts = [...(editingItem.receipts || []), ...uploadedReceipts].slice(0, 3)

      const collectionName = editingItem.type === 'income' ? 'incomes' : 'expenses'
      const numericAmount = parseFloat(editingItem.originalAmount || 0)
      const rate = parseFloat(editingItem.exchangeRate) || 440

      let amountCRC = editingItem.currency === 'CRC' ? numericAmount : numericAmount * rate
      let amountUSD = editingItem.currency === 'USD' ? numericAmount : numericAmount / rate

      const docRef = doc(db, collectionName, editingItem.id)
      const payload = {
        propertyId: editingItem.propertyId,
        description: editingItem.description,
        date: editingItem.date,
        currency: editingItem.currency,
        originalAmount: numericAmount,
        exchangeRate: editingItem.currency === 'USD' ? rate : null,
        amountCRC: parseFloat(amountCRC.toFixed(2)),
        amountUSD: parseFloat(amountUSD.toFixed(2)),
        receipts,
      }
      
      if (editingItem.type === 'expense') {
        payload.providerId = editingItem.providerId || null
      }

      await updateDoc(docRef, payload)
      setEditingItem(null)
      setEditFiles([])
      setRemovedReceipts([])
      loadFinancialData()
    } catch (error) {
      console.error('Error al actualizar:', error)
      alert('Error saving changes.')
    } finally {
      setEditLoading(false)
    }
  }

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)
  const selectedOwnerName = selectedProperty ? (clients[selectedProperty.clientId] || selectedProperty.ownerName || selectedProperty.owner || 'No owner assigned') : ''

  // Cálculos Financieros
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

      const fileName = `Account_Statement_${(selectedProperty?.name || 'Property').replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Error al generar el PDF:', error)
      alert('The PDF could not be generated.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  // Cálculos en tiempo real para el modal de edición
  const editAmt = parseFloat(editingItem?.originalAmount || 0)
  const editRate = parseFloat(editingItem?.exchangeRate || 440)
  const calcEditCRC = editingItem?.currency === 'CRC' && editAmt ? editAmt : editAmt * editRate
  const calcEditUSD = editingItem?.currency === 'USD' && editAmt ? editAmt : editAmt / editRate

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Filtros */}
      <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Detailed Account Statement</h2>
              <p className="text-xs text-slate-400">Cash flow, income and expenses by property</p>
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

            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm font-semibold text-white focus:outline-none"
              >
                <option value="">Select a property...</option>
                {properties.map(p => {
                  const owner = clients[p.clientId] || p.ownerName || p.owner || 'No owner'
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name || 'Unnamed'} ({owner})
                    </option>
                  )
                })}
              </select>
            </div>
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

      <div className="space-y-6">

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-2">
            <Wallet className={`h-4 w-4 shrink-0 ${openingBalanceUSD >= 0 ? 'text-slate-300' : 'text-rose-400'}`} />
            <span className="text-[11px] font-medium uppercase tracking-wider">Opening Balance</span>
          </div>
          <div className={`text-lg font-black whitespace-nowrap ${openingBalanceUSD >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
            {openingBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(openingBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Balance before {startDate}</span>
        </div>

        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-2">
            <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Income for the Period</span>
          </div>
          <div className="text-lg font-black whitespace-nowrap text-emerald-400">
            + $ {totalIncomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{incomeList.length} deposits recorded</span>
        </div>

        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-2">
            <ArrowUpRight className="h-4 w-4 shrink-0 text-rose-400" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Expenses for the Period</span>
          </div>
          <div className="text-lg font-black whitespace-nowrap text-rose-400">
            - $ {totalExpenseUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{expenseList.length} receipts paid</span>
        </div>

        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-2">
            <Wallet className={`h-4 w-4 shrink-0 ${netPeriodBalanceUSD >= 0 ? 'text-amber-400' : 'text-rose-400'}`} />
            <span className="text-[11px] font-medium uppercase tracking-wider">Net Balance for the Period</span>
          </div>
          <div className={`text-lg font-black whitespace-nowrap ${netPeriodBalanceUSD >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
            {netPeriodBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(netPeriodBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Income minus expenses for the period</span>
        </div>

        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-md min-w-0 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-2">
            <Wallet className={`h-4 w-4 shrink-0 ${accumulatedBalanceUSD >= 0 ? 'text-cyan-400' : 'text-rose-400'}`} />
            <span className="text-[11px] font-medium uppercase tracking-wider">Accumulated Balance</span>
          </div>
          <div className={`text-lg font-black whitespace-nowrap ${accumulatedBalanceUSD >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
            {accumulatedBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(accumulatedBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Balance carried forward through {endDate}</span>
        </div>
      </div>

      {/* TABLA DE INGRESOS */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-900/40 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4" /> Income / Deposits
          </h3>
          <span className="text-xs text-slate-400">{incomeList.length} entries</span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-400 text-xs">Loading...</div>
        ) : incomeList.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No deposits in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Amount ($ USD)</th>
                  <th className="py-2.5 px-4 text-center">Receipt</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
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
                      {getReceipts(inc).length ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {getReceipts(inc).map((r, idx) => (
                            <a key={idx} href={r.url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center justify-center gap-1" title={r.name}>
                              {r.name.length > 16 ? `${r.name.slice(0, 14)}…` : r.name} <ExternalLink className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px]">No attachment</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1">
                      <button 
                        onClick={() => {
                          setEditingItem({ 
                            type: 'income', 
                            currency: inc.currency || 'USD', 
                            originalAmount: inc.originalAmount || inc.amountUSD || '', 
                            exchangeRate: inc.exchangeRate || 440,
                            propertyId: inc.propertyId || selectedPropertyId,
                            ...inc,
                            receipts: getReceipts(inc)
                          })
                          setEditFiles([])
                          setRemovedReceipts([])
                        }}
                        className="p-1 text-amber-400 hover:bg-slate-700 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(inc.id, 'income')}
                        className="p-1 text-rose-400 hover:bg-slate-700 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TABLA DE GASTOS */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-900/40 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" /> Expenses / Services
          </h3>
          <span className="text-xs text-slate-400">{expenseList.length} entries</span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-400 text-xs">Loading...</div>
        ) : expenseList.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No expenses in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Provider</th>
                  <th className="py-2.5 px-4">Amount ($ USD)</th>
                  <th className="py-2.5 px-4 text-center">Receipt</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
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
                      {getReceipts(exp).length ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {getReceipts(exp).map((r, idx) => (
                            <a key={idx} href={r.url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center justify-center gap-1" title={r.name}>
                              {r.name.length > 16 ? `${r.name.slice(0, 14)}…` : r.name} <ExternalLink className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px]">No attachment</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1">
                      <button 
                        onClick={() => {
                          setEditingItem({ 
                            type: 'expense', 
                            currency: exp.currency || 'CRC', 
                            originalAmount: exp.originalAmount || exp.amountCRC || '', 
                            exchangeRate: exp.exchangeRate || 440,
                            providerId: exp.providerId || '',
                            propertyId: exp.propertyId || selectedPropertyId,
                            ...exp,
                            receipts: getReceipts(exp)
                          })
                          setEditFiles([])
                          setRemovedReceipts([])
                        }}
                        className="p-1 text-amber-400 hover:bg-slate-700 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(exp.id, 'expense')}
                        className="p-1 text-rose-400 hover:bg-slate-700 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </div>

      {/* Plantilla blanca oculta, usada únicamente para generar el PDF */}
      <div className="fixed top-0 pointer-events-none" style={{ left: '-9999px' }}>
        <div ref={pdfTemplateRef} className="bg-white text-slate-900 w-200">
          <div className="p-6 border-b-2 border-emerald-600 flex items-center gap-4">
            <img src="/fae-logo.png" alt="FAE Property Solutions" className="h-16 w-16 object-contain" />
            <div>
              <h1 className="text-xl font-bold">FAE Property Solutions</h1>
              <p className="text-sm font-semibold">
                Account Statement: {selectedProperty?.name} (Owner: {selectedOwnerName})
              </p>
              <p className="text-xs text-slate-500">Period from {startDate} to {endDate}</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <div className="flex justify-center items-center text-slate-500 mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider">Opening Balance</span>
                </div>
                <div className={`text-base font-black whitespace-nowrap ${openingBalanceUSD >= 0 ? 'text-slate-700' : 'text-rose-600'}`}>
                  {openingBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(openingBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Balance before {startDate}</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <div className="flex justify-center items-center text-slate-500 mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider">Income for the Period</span>
                </div>
                <div className="text-base font-black whitespace-nowrap text-emerald-600">
                  + $ {totalIncomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">{incomeList.length} deposits recorded</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <div className="flex justify-center items-center text-slate-500 mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider">Expenses for the Period</span>
                </div>
                <div className="text-base font-black whitespace-nowrap text-rose-600">
                  - $ {totalExpenseUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">{expenseList.length} receipts paid</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <div className="flex justify-center items-center text-slate-500 mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider">Net Balance for the Period</span>
                </div>
                <div className={`text-base font-black whitespace-nowrap ${netPeriodBalanceUSD >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {netPeriodBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(netPeriodBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Income minus expenses for the period</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <div className="flex justify-center items-center text-slate-500 mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider">Accumulated Balance</span>
                </div>
                <div className={`text-base font-black whitespace-nowrap ${accumulatedBalanceUSD >= 0 ? 'text-cyan-600' : 'text-rose-600'}`}>
                  {accumulatedBalanceUSD >= 0 ? '+' : '-'} $ {Math.abs(accumulatedBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Balance carried forward through {endDate}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-emerald-700">Income / Deposits</h3>
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
                    <tr><td colSpan={3} className="py-4 px-4 text-center text-slate-400">No deposits in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-rose-700">Expenses / Services</h3>
              </div>
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Description</th>
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
                    <tr><td colSpan={4} className="py-4 px-4 text-center text-slate-400">No expenses in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE EDICIÓN COMPLETO */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="rounded-2xl bg-slate-800 p-6 border border-slate-700 max-w-2xl w-full mx-auto shadow-2xl relative my-8">
            <button 
              onClick={() => { setEditingItem(null); setEditFiles([]); setRemovedReceipts([]) }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-900/50 p-1.5 rounded-xl border border-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${editingItem.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {editingItem.type === 'income' ? <ArrowDownLeft className="h-6 w-6" /> : <Receipt className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingItem.type === 'income' ? 'Edit Income / Deposit' : 'Edit Expense / Service'}
                </h3>
                <p className="text-xs text-slate-400">Modify the financial record details</p>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Select House / Property</label>
                <select
                  value={editingItem.propertyId || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, propertyId: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                >
                  {properties.map(p => {
                    const owner = clients[p.clientId] || p.ownerName || p.owner || 'No owner'
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name || 'Unnamed'} — Owner: {owner}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Transaction Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    value={editingItem.date || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, date: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 pl-10 text-sm text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Description / Service</label>
                <input
                  type="text"
                  required
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              {editingItem.type === 'expense' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Provider (Optional)</label>
                  <select
                    value={editingItem.providerId || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, providerId: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                  >
                    <option value="">None / Generic</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.serviceType ? `${p.name} (${p.serviceType})` : p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Currency</label>
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, currency: 'CRC' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${editingItem.currency === 'CRC' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      ₡ CRC
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, currency: 'USD' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${editingItem.currency === 'USD' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      $ USD
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Amount in {editingItem.currency === 'CRC' ? 'Colones (₡)' : 'Dollars ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingItem.originalAmount || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, originalAmount: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 p-3 border border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
                <div>
                  <span className="text-slate-500">Exchange Rate: </span>
                  <input
                    type="number"
                    value={editingItem.exchangeRate ?? ''}
                    onChange={(e) => setEditingItem({ ...editingItem, exchangeRate: e.target.value })}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-semibold text-white ml-1 inline-block"
                  />
                </div>
                <div className="text-right">
                  <div>Total Colones: <span className="font-bold text-emerald-400">₡ {calcEditCRC.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div>Total Dollars: <span className="font-bold text-emerald-400">$ {calcEditUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span></div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Receipts (Max. 3 files)</label>

                {editingItem.receipts?.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {editingItem.receipts.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-2">
                        <input
                          type="text"
                          value={r.name}
                          onChange={(e) => {
                            const updated = [...editingItem.receipts]
                            updated[idx] = { ...updated[idx], name: e.target.value }
                            setEditingItem({ ...editingItem, receipts: updated })
                          }}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                        />
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-emerald-400 hover:bg-slate-700 rounded" title="View">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = editingItem.receipts.filter((_, i) => i !== idx)
                            setEditingItem({ ...editingItem, receipts: updated })
                            if (r.path) setRemovedReceipts(prev => [...prev, r])
                          }}
                          className="p-1.5 text-rose-400 hover:bg-slate-700 rounded"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(editingItem.receipts?.length || 0) + editFiles.length < 3 && (
                  <div className="relative border-2 border-dashed border-slate-700 rounded-xl p-3 text-center bg-slate-900/30">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={(e) => {
                        const selected = Array.from(e.target.files)
                        const remaining = 3 - (editingItem.receipts?.length || 0)
                        if (selected.length > remaining) {
                          alert(`You can only add ${remaining} more file(s).`)
                          return
                        }
                        setEditFiles(selected)
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Upload className="h-5 w-5 text-slate-400" />
                      <span className="text-xs text-slate-300 font-medium">
                        {editFiles.length ? `${editFiles.length} new file(s): ${editFiles.map(f => f.name).join(', ')}` : 'Add new file(s)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => { setEditingItem(null); setEditFiles([]); setRemovedReceipts([]) }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 border border-slate-700 hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-all shadow-lg flex items-center gap-2"
                >
                  {editLoading ? 'Saving...' : <><Check className="h-4 w-4" /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}