import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SharedAccountPdfTemplate, { exportElementToPdf } from './SharedAccountPdf'
import { db } from '../firebase/config'
import {
  collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import DateRangePicker from './DateRangePicker'
import { getCostaRicaDate, getCostaRicaMonthStart } from '../utils/formValues'
import {
  validateAccount, buildIncome, computeAccountStatement, generateAccessCode,
} from '../utils/sharedAccounts'
import {
  ArrowDownLeft, ArrowUpRight, Check, Copy, Home, KeyRound, Layers, Pencil, Plus, Printer, RefreshCw, Trash2, Wallet, X,
} from 'lucide-react'

const money = value => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = value => `${value >= 0 ? '+' : '-'} $ ${money(Math.abs(value))}`

export default function SharedAccounts() {
  const [accounts, setAccounts] = useState([])
  const [properties, setProperties] = useState([])
  const [propertyCodes, setPropertyCodes] = useState([])
  const [incomes, setIncomes] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [startDate, setStartDate] = useState(getCostaRicaMonthStart())
  const [endDate, setEndDate] = useState(getCostaRicaDate())
  const [expenses, setExpenses] = useState([])
  const [houseIncomes, setHouseIncomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [copiedCode, setCopiedCode] = useState('')
  const [providers, setProviders] = useState([])
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const pdfRef = useRef(null)

  const [editor, setEditor] = useState(null)
  const [editorError, setEditorError] = useState('')
  const [saving, setSaving] = useState(false)
  const [incomeForm, setIncomeForm] = useState({ description: '', date: getCostaRicaDate(), currency: 'USD', amount: '', exchangeRate: '500' })
  const [incomeError, setIncomeError] = useState('')

  const loadAccounts = useCallback(async () => {
    try {
      const [accountSnap, propertySnap, directorySnap] = await Promise.all([
        getDocs(collection(db, 'sharedAccounts')),
        getDocs(collection(db, 'properties')),
        getDocs(collection(db, 'propertyStatementDirectory')),
      ])
      const accountList = accountSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      accountList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }))
      const directory = directorySnap.docs.map(d => ({ id: d.id, ...d.data() }))
      directory.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }))
      setAccounts(accountList)
      setProperties(directory)
      setPropertyCodes(propertySnap.docs.map(d => d.data().accessCode).filter(Boolean))
      setLoadError('')
    } catch (error) {
      console.error('Error al cargar cuentas compartidas:', error)
      setLoadError('No se pudieron cargar las cuentas compartidas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  useEffect(() => {
    fetch('https://api.hacienda.go.cr/indicadores/tc/dolar')
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(response.status))))
      .then(data => {
        const rate = data?.compra?.valor || data?.venta?.valor
        if (rate) setIncomeForm(form => ({ ...form, exchangeRate: String(Math.round(rate)) }))
      })
      .catch(() => {})
  }, [])

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || null
  const propertyName = id => properties.find(p => p.id === id)?.name || 'Casa eliminada'
  const accountKey = selectedAccount?.propertyIds?.join('|') || ''

  const loadAccountIncomes = useCallback(async accountId => {
    if (!accountId) return
    try {
      const snap = await getDocs(query(collection(db, 'sharedAccountIncomes'), where('accountId', '==', accountId)))
      setIncomes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error('Error al cargar ingresos de la cuenta:', error)
      setLoadError('No se pudieron cargar los ingresos de la cuenta.')
    }
  }, [])

  useEffect(() => { loadAccountIncomes(selectedAccountId) }, [selectedAccountId, loadAccountIncomes])

  useEffect(() => {
    if (!accountKey) return
    let cancelled = false
    const loadMovements = async () => {
      setLoadingMovements(true)
      try {
        const ids = accountKey.split('|')
        const fetchByProperty = collectionName => Promise.all(ids.map(id =>
          getDocs(query(collection(db, collectionName), where('propertyId', '==', id)))))
        const [expenseSnaps, incomeSnaps] = await Promise.all([fetchByProperty('expenses'), fetchByProperty('incomes')])
        const toList = snaps => snaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
        if (!cancelled) {
          setExpenses(toList(expenseSnaps))
          setHouseIncomes(toList(incomeSnaps))
        }
      } catch (error) {
        console.error('Error al cargar movimientos de las casas:', error)
        if (!cancelled) setLoadError('No se pudieron cargar los movimientos de las casas.')
      } finally {
        if (!cancelled) setLoadingMovements(false)
      }
    }
    loadMovements()
    return () => { cancelled = true }
  }, [accountKey])

  const statement = useMemo(() => selectedAccount
    ? computeAccountStatement({ account: selectedAccount, incomes, houseIncomes, expenses, startDate, endDate })
    : null, [selectedAccount, incomes, houseIncomes, expenses, startDate, endDate])

  useEffect(() => {
    getDocs(collection(db, 'providerDirectory'))
      .then(snap => setProviders(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(error => console.error('Error al cargar proveedores:', error))
  }, [])

  const providerName = id => providers.find(p => p.id === id)?.name || 'N/A'

  const handleDownloadPdf = async () => {
    if (!pdfRef.current || !selectedAccount) return
    setGeneratingPdf(true)
    try {
      await exportElementToPdf(
        pdfRef.current,
        `Account_Statement_${selectedAccount.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`,
      )
    } catch (error) {
      console.error('Error al generar el PDF:', error)
      alert('No se pudo generar el PDF.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const takenCodes = (ignoreAccountId = null) => [
    ...propertyCodes,
    ...accounts.filter(a => a.id !== ignoreAccountId).map(a => a.accessCode),
  ]

  const openEditor = account => {
    setEditorError('')
    setEditor(account
      ? { id: account.id, name: account.name, propertyIds: account.propertyIds || [], accessCode: account.accessCode || generateAccessCode() }
      : { id: null, name: '', propertyIds: [], accessCode: generateAccessCode() })
  }

  const regenerateCode = () => {
    const taken = takenCodes(editor.id).map(code => (code || '').toUpperCase())
    let code = generateAccessCode()
    while (taken.includes(code)) code = generateAccessCode()
    setEditor({ ...editor, accessCode: code })
  }

  const toggleEditorProperty = propertyId => setEditor(current => ({
    ...current,
    propertyIds: current.propertyIds.includes(propertyId)
      ? current.propertyIds.filter(id => id !== propertyId)
      : [...current.propertyIds, propertyId],
  }))

  const handleSaveAccount = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      const data = validateAccount(accounts, editor, takenCodes(editor.id))
      if (editor.id) {
        await updateDoc(doc(db, 'sharedAccounts', editor.id), data)
      } else {
        const created = await addDoc(collection(db, 'sharedAccounts'), { ...data, createdAt: serverTimestamp() })
        setSelectedAccountId(created.id)
      }
      setEditor(null)
      await loadAccounts()
    } catch (error) {
      setEditorError(error.message || 'No se pudo guardar la cuenta.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async account => {
    if (!confirm(`¿Eliminar la cuenta "${account.name}" y sus ingresos? Los gastos e ingresos de las casas no se borran.`)) return
    try {
      const incomeSnap = await getDocs(query(collection(db, 'sharedAccountIncomes'), where('accountId', '==', account.id)))
      const batch = writeBatch(db)
      incomeSnap.docs.forEach(d => batch.delete(d.ref))
      batch.delete(doc(db, 'sharedAccounts', account.id))
      await batch.commit()
      if (selectedAccountId === account.id) {
        setSelectedAccountId('')
        setIncomes([])
      }
      await loadAccounts()
    } catch (error) {
      console.error('Error al eliminar la cuenta:', error)
      alert('No se pudo eliminar la cuenta.')
    }
  }

  const handleAddIncome = async event => {
    event.preventDefault()
    try {
      const income = buildIncome({
        accountId: selectedAccount.id,
        description: incomeForm.description,
        date: incomeForm.date,
        currency: incomeForm.currency,
        originalAmount: incomeForm.amount,
        exchangeRate: incomeForm.exchangeRate,
      })
      await addDoc(collection(db, 'sharedAccountIncomes'), { ...income, createdAt: serverTimestamp() })
      setIncomeForm(form => ({ ...form, description: '', amount: '' }))
      setIncomeError('')
      await loadAccountIncomes(selectedAccount.id)
    } catch (error) {
      setIncomeError(error.message || 'No se pudo registrar el ingreso.')
    }
  }

  const handleDeleteIncome = async incomeId => {
    if (!confirm('¿Eliminar este ingreso de la cuenta?')) return
    try {
      await deleteDoc(doc(db, 'sharedAccountIncomes', incomeId))
      await loadAccountIncomes(selectedAccountId)
    } catch (error) {
      console.error('Error al eliminar el ingreso:', error)
      alert('No se pudo eliminar el ingreso.')
    }
  }

  const copyCode = async code => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(''), 1500)
    } catch {
      setCopiedCode('')
    }
  }

  const propertyOwnedByOtherAccount = propertyId =>
    accounts.find(a => a.id !== editor?.id && (a.propertyIds || []).includes(propertyId))

  const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-300"><Layers className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-white">Cuentas compartidas</h2>
            <p className="text-xs text-slate-400">Agrupa casas que comparten ingresos; los gastos siguen en cada casa.</p>
          </div>
        </div>
        <button
          onClick={() => openEditor(null)}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Nueva cuenta
        </button>
      </div>

      {loadError && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{loadError}</p>}

      {loading ? (
        <p className="p-6 text-center text-sm text-slate-400">Cargando cuentas…</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          Aún no hay cuentas compartidas. Crea una y elige las casas que comparten fondos.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map(account => {
            const active = account.id === selectedAccountId
            return (
              <div
                key={account.id}
                className={`rounded-xl border p-4 transition-colors ${active ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-800'}`}
              >
                <button onClick={() => setSelectedAccountId(account.id)} className="block w-full text-left">
                  <p className="text-sm font-bold text-white">{account.name}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{(account.propertyIds || []).map(propertyName).join(' · ')}</p>
                </button>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-slate-900/60 px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><KeyRound className="h-3.5 w-3.5" /> Código</span>
                  <span className="font-mono text-sm font-bold tracking-widest text-emerald-300">{account.accessCode}</span>
                  <button onClick={() => copyCode(account.accessCode)} aria-label="Copiar código" className="text-slate-400 hover:text-white">
                    {copiedCode === account.accessCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button onClick={() => setSelectedAccountId(account.id)} className="text-xs font-semibold text-cyan-400 hover:underline">
                    {active ? 'Viendo estado' : 'Ver estado'}
                  </button>
                  <div className="flex gap-1">
                    <button onClick={() => openEditor(account)} aria-label="Editar cuenta" className="rounded p-1 text-amber-400 hover:bg-slate-700"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDeleteAccount(account)} aria-label="Eliminar cuenta" className="rounded p-1 text-red-400 hover:bg-slate-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedAccount && statement && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-300">Rango de fechas</label>
              <DateRangePicker locale="en" startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
            </div>
            <div className="flex items-center justify-between gap-3 pb-1 md:flex-col md:items-end">
              <p className="text-xs text-slate-400">
                {selectedAccount.name}: <strong className="text-white">{selectedAccount.propertyIds.map(propertyName).join(' + ')}</strong>
              </p>
              <button
                onClick={handleDownloadPdf}
                disabled={generatingPdf || loadingMovements}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg transition-all hover:bg-emerald-400 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" /> {generatingPdf ? 'Generando PDF...' : 'Descargar PDF'}
              </button>
            </div>
            <SharedAccountPdfTemplate
              ref={pdfRef}
              account={selectedAccount}
              statement={statement}
              nameOf={propertyName}
              providerName={providerName}
              startDate={startDate}
              endDate={endDate}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['Saldo anterior', statement.openingBalanceUSD, 'text-slate-200'],
              ['Ingresos', statement.totalIncomeUSD, 'text-emerald-300'],
              ['Gastos', -statement.totalExpenseUSD, 'text-amber-300'],
              ['Balance del periodo', statement.netPeriodBalanceUSD, statement.netPeriodBalanceUSD >= 0 ? 'text-emerald-300' : 'text-red-300'],
              ['Saldo acumulado', statement.accumulatedBalanceUSD, statement.accumulatedBalanceUSD >= 0 ? 'text-emerald-300' : 'text-red-300'],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                <p className={`mt-1 text-sm font-bold ${color}`}>{signed(value)}</p>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-700 p-4">
              <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Ingresos de la cuenta</h3>
              {loadingMovements && <span className="text-[11px] text-slate-500">Cargando…</span>}
            </div>
            <form onSubmit={handleAddIncome} className="grid grid-cols-2 gap-2 border-b border-slate-700 bg-slate-900/40 p-3 md:grid-cols-6">
              <input type="date" value={incomeForm.date} onChange={e => setIncomeForm({ ...incomeForm, date: e.target.value })} aria-label="Fecha del ingreso" className={`${inputClass} md:col-span-1`} />
              <input value={incomeForm.description} onChange={e => setIncomeForm({ ...incomeForm, description: e.target.value })} placeholder="Descripción" aria-label="Descripción del ingreso" className={`${inputClass} md:col-span-2`} />
              <select value={incomeForm.currency} onChange={e => setIncomeForm({ ...incomeForm, currency: e.target.value })} aria-label="Moneda" className={inputClass}>
                <option value="USD">USD</option>
                <option value="CRC">CRC</option>
              </select>
              <input type="number" min="0" step="0.01" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} placeholder="Monto" aria-label="Monto" className={inputClass} />
              <button type="submit" className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
                <Plus className="h-4 w-4" /> Agregar
              </button>
              {incomeForm.currency === 'CRC' && (
                <div className="col-span-2 flex items-center gap-2 text-[11px] text-slate-400 md:col-span-6">
                  Tipo de cambio ₡/$
                  <input type="number" min="1" value={incomeForm.exchangeRate} onChange={e => setIncomeForm({ ...incomeForm, exchangeRate: e.target.value })} aria-label="Tipo de cambio" className="w-24 rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-white" />
                </div>
              )}
              {incomeError && <p className="col-span-2 text-xs text-red-400 md:col-span-6">{incomeError}</p>}
            </form>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50 uppercase tracking-wider text-slate-400">
                  <th className="p-3">Fecha</th><th className="p-3">Origen</th><th className="p-3">Descripción</th><th className="p-3 text-right">Monto USD</th><th className="w-10 p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {statement.periodIncomes.map(income => (
                  <tr key={income.id}>
                    <td className="p-3 text-slate-300">{income.date || '—'}</td>
                    <td className="p-3 text-slate-300">{income.accountId ? 'CP' : propertyName(income.propertyId)}</td>
                    <td className="p-3 text-white">{income.description}</td>
                    <td className="p-3 text-right font-semibold text-emerald-300">+ $ {money(income.amountUSD)}</td>
                    <td className="p-3 text-right">
                      {income.accountId && (
                        <button onClick={() => handleDeleteIncome(income.id)} aria-label="Eliminar ingreso" className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
                {statement.periodIncomes.length === 0 && <tr><td colSpan={5} className="p-5 text-center text-slate-500">Sin ingresos en este periodo.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-700 p-4">
              <ArrowUpRight className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Gastos por casa</h3>
              {loadingMovements && <span className="text-[11px] text-slate-500">Cargando…</span>}
            </div>
            {statement.expensesByProperty.map(group => (
              <div key={group.propertyId} className="border-b border-slate-700 last:border-b-0">
                <div className="flex items-center justify-between bg-slate-900/50 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-bold text-white"><Home className="h-3.5 w-3.5 text-amber-300" /> {propertyName(group.propertyId)}</span>
                  <span className="text-xs font-bold text-amber-300">- $ {money(group.totalUSD)}</span>
                </div>
                <table className="w-full border-collapse text-left text-xs">
                  <tbody className="divide-y divide-slate-700/60">
                    {group.items.map(expense => (
                      <tr key={expense.id}>
                        <td className="w-28 px-4 py-2 text-slate-400">{expense.date || '—'}</td>
                        <td className="px-4 py-2 text-slate-200">{expense.description || 'Gasto'}</td>
                        <td className="px-4 py-2 text-right text-amber-300">- $ {money(expense.amountUSD)}</td>
                      </tr>
                    ))}
                    {group.items.length === 0 && <tr><td className="px-4 py-3 text-slate-500">Sin gastos en este periodo.</td></tr>}
                  </tbody>
                </table>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-slate-700 bg-slate-900/70 px-4 py-3 text-xs font-bold">
              <span className="flex items-center gap-2 text-slate-300"><Wallet className="h-4 w-4 text-emerald-400" /> Balance del periodo (ingresos − gastos de todas las casas)</span>
              <span className={statement.netPeriodBalanceUSD >= 0 ? 'text-emerald-300' : 'text-red-300'}>{signed(statement.netPeriodBalanceUSD)}</span>
            </div>
          </section>
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={handleSaveAccount} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-6 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-base font-bold text-white">{editor.id ? 'Editar cuenta compartida' : 'Nueva cuenta compartida'}</h3>
              <button type="button" onClick={() => setEditor(null)} aria-label="Cerrar" className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label htmlFor="account-name" className="mb-1 block font-medium text-slate-300">Nombre de la cuenta</label>
              <input id="account-name" value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} placeholder="Ej. CP · Andrea Vargas" className={inputClass} />
            </div>
            <div>
              <label htmlFor="account-code" className="mb-1 block font-medium text-slate-300">Código de acceso del dueño</label>
              <div className="flex gap-2">
                <input id="account-code" value={editor.accessCode} onChange={e => setEditor({ ...editor, accessCode: e.target.value.toUpperCase() })} maxLength={12} className={`${inputClass} font-mono tracking-widest`} />
                <button type="button" onClick={regenerateCode} aria-label="Generar otro código" className="rounded-xl border border-slate-700 px-3 text-slate-300 hover:text-white"><RefreshCw className="h-4 w-4" /></button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Con este código el dueño ve el estado conjunto de las casas de esta cuenta.</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-300">Casas que comparten esta cuenta ({editor.propertyIds.length})</p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {properties.map(property => {
                  const other = propertyOwnedByOtherAccount(property.id)
                  const checked = editor.propertyIds.includes(property.id)
                  return (
                    <label key={property.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${other ? 'cursor-not-allowed border-slate-800 opacity-50' : checked ? 'cursor-pointer border-emerald-500/40 bg-emerald-500/5' : 'cursor-pointer border-slate-700 bg-slate-900/50'}`}>
                      <input type="checkbox" disabled={Boolean(other)} checked={checked} onChange={() => toggleEditorProperty(property.id)} className="h-4 w-4 accent-emerald-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{property.name || 'Sin nombre'}</span>
                        <span className="block text-[11px] text-slate-400">{other ? `Ya está en "${other.name}"` : (property.ownerName || 'Sin dueño')}</span>
                      </span>
                      {checked && <Check className="h-4 w-4 text-emerald-400" />}
                    </label>
                  )
                })}
              </div>
            </div>
            {editorError && <p className="text-red-400">{editorError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-slate-700 px-4 py-2 text-slate-300 hover:text-white">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
