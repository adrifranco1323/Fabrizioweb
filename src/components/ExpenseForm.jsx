import { useState, useEffect } from 'react'
import { db, storage } from '../firebase/config'
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Receipt, Upload, Check, ArrowDownLeft, Calendar } from 'lucide-react'

export default function ExpenseForm({ onExpenseAdded }) {
  const [movementType, setMovementType] = useState('expense')
  const [propertyId, setPropertyId] = useState('')
  const [properties, setProperties] = useState([])
  const [clients, setClients] = useState({})
  const [providers, setProviders] = useState([])
  const [description, setDescription] = useState('')
  const [providerId, setProviderId] = useState('')
  const [currency, setCurrency] = useState('CRC')
  const [amount, setAmount] = useState('')
  const [exchangeRate, setExchangeRate] = useState(440)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Cargar Clientes para armar el diccionario por ID
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
        setProperties(propList)
        if (propList.length > 0) setPropertyId(propList[0].id)

        // 3. Cargar Proveedores
        const provSnap = await getDocs(collection(db, 'providers'))
        const provList = provSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setProviders(provList)
      } catch (e) {
        console.log('Error cargando datos auxiliares:', e)
      }
    }

    const fetchExchangeRate = async () => {
      // api.hacienda.go.cr no permite peticiones desde el navegador (CORS), se usa una API pública alterna
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD')
        const data = await response.json()
        const rate = data?.rates?.CRC
        if (rate) {
          setExchangeRate(rate)
        }
      } catch (error) {
        console.log('Usando tipo de cambio por defecto', error)
      }
    }

    fetchData()
    fetchExchangeRate()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || !propertyId) return

    setLoading(true)
    try {
      const receipts = []
      if (files.length) {
        const folder = movementType === 'income' ? 'incomes' : 'expenses'
        for (const f of files) {
          const path = `${folder}/${Date.now()}_${f.name}`
          const fileRef = ref(storage, path)
          await uploadBytes(fileRef, f)
          const url = await getDownloadURL(fileRef)
          receipts.push({ url, name: f.name, path })
        }
      }

      const numericAmount = parseFloat(amount)
      let amountCRC = currency === 'CRC' ? numericAmount : numericAmount * exchangeRate
      let amountUSD = currency === 'USD' ? numericAmount : numericAmount / exchangeRate

      const targetCollection = movementType === 'income' ? 'incomes' : 'expenses'

      const payload = {
        propertyId,
        description: description || (movementType === 'income' ? 'Aporte / Ingreso' : 'Gasto General'),
        amountCRC,
        amountUSD,
        date,
        receipts,
        createdAt: serverTimestamp()
      }

      if (movementType === 'expense') {
        payload.providerId = providerId || null
        payload.currency = currency
        payload.originalAmount = numericAmount
        payload.exchangeRate = currency === 'USD' ? exchangeRate : null
      }

      await addDoc(collection(db, targetCollection), payload)

      setAmount('')
      setDescription('')
      setFiles([])
      setDate(new Date().toISOString().split('T')[0])
      setSuccess(true)
      if (onExpenseAdded) onExpenseAdded()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Error al registrar movimiento:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculatedCRC = currency === 'CRC' && amount ? parseFloat(amount) : (amount ? parseFloat(amount) * exchangeRate : 0)
  const calculatedUSD = currency === 'USD' && amount ? parseFloat(amount) : (amount ? parseFloat(amount) / exchangeRate : 0)

  return (
    <div className="rounded-2xl bg-slate-800 p-6 border border-slate-700 max-w-2xl mx-auto shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${movementType === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {movementType === 'income' ? <ArrowDownLeft className="h-6 w-6" /> : <Receipt className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {movementType === 'income' ? 'Registrar Ingreso / Depósito' : 'Registrar Nuevo Gasto / Servicio'}
            </h2>
            <p className="text-xs text-slate-400">
              {movementType === 'income' ? 'Acredita fondos a la propiedad' : 'Sube recibos de servicios o mantenimiento en ₡ o $'}
            </p>
          </div>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setMovementType('expense')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${movementType === 'expense' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
          >
            Gasto
          </button>
          <button
            type="button"
            onClick={() => setMovementType('income')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${movementType === 'income' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
          >
            Ingreso
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">
          <Check className="h-5 w-5" /> ¡Movimiento registrado correctamente!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">Seleccionar Casa / Propiedad</label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
          >
            {properties.map(p => {
              const owner = clients[p.clientId] || p.ownerName || p.owner || 'Sin dueño'
              return (
                <option key={p.id} value={p.id}>
                  {p.name || 'Sin nombre'} — Dueño: {owner}
                </option>
              )
            })}
          </select>
        </div>

        {/* Campo de Fecha Incorporado */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">Fecha del Movimiento (Histórica / Real)</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 pl-10 text-sm text-white focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Detalle / Servicio</label>
            <input
              type="text"
              required
              placeholder={movementType === 'income' ? 'Ej. Depósito Fondo de Reserva' : 'Ej. Recibo ICE, Mantenimiento'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
            />
          </div>
        </div>

        {movementType === 'expense' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Proveedor (Opcional)</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
            >
              <option value="">Ninguno / Genérico</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.serviceType ? `${p.name} (${p.serviceType})` : p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Moneda</label>
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setCurrency('CRC')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${currency === 'CRC' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                ₡ CRC
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${currency === 'USD' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                $ USD
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Monto en {currency === 'CRC' ? 'Colones (₡)' : 'Dólares ($)'}
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder={currency === 'CRC' ? 'Ej. 45000' : 'Ej. 150.00'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm font-bold text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-900 p-3 border border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
          <div>
            <span className="text-slate-500">Tipo de Cambio: </span>
            <input
              type="number"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
              className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-semibold text-white ml-1 inline-block"
            />
          </div>
          <div className="text-right">
            <div>Total Colones: <span className="font-bold text-emerald-400">₡ {calculatedCRC.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            <div>Total Dólares: <span className="font-bold text-emerald-400">$ {calculatedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span></div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">Comprobante / Recibo (Máx. 3 archivos, Foto o PDF)</label>
          <div className="relative border-2 border-dashed border-slate-700 rounded-xl p-3 text-center bg-slate-900/30">
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => {
                const selected = Array.from(e.target.files)
                if (selected.length > 3) {
                  alert('Puedes adjuntar un máximo de 3 archivos.')
                  return
                }
                setFiles(selected)
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
              <Upload className="h-4 w-4" />
              <span>{files.length ? `${files.length} archivo(s): ${files.map(f => f.name).join(', ')}` : 'Subir hasta 3 archivos del comprobante'}</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold transition-all text-slate-900 disabled:opacity-50 ${movementType === 'income' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-amber-500 hover:bg-amber-400'}`}
        >
          {loading ? 'Guardando...' : (movementType === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto')}
        </button>
      </form>
    </div>
  )
}