import { useState, useEffect } from 'react'
import { db, storage } from '../firebase/config'
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { PlusCircle, Upload, Check, RefreshCw } from 'lucide-react'

export default function ExpenseForm({ onExpenseAdded }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Luz')
  const [currency, setCurrency] = useState('CRC') // 'CRC' o 'USD'
  const [amountInput, setAmountInput] = useState('')
  
  // Tipo de cambio del BAC (Por defecto 458)
  const [exchangeRate, setExchangeRate] = useState('458')
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false)

  const [propertyId, setPropertyId] = useState('')
  const [properties, setProperties] = useState([])
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Obtener tipo de cambio del BAC / Costa Rica
  const fetchBACExchangeRate = async () => {
    setLoadingExchangeRate(true)
    try {
      const response = await fetch('https://api.hacienda.go.cr/indicadores/tc/dolar')
      if (response.ok) {
        const data = await response.json()
        if (data && data.venta && data.venta.valor) {
          // Si la API responde, sugerir ese valor
          setExchangeRate(data.venta.valor.toString())
        }
      }
    } catch (error) {
      console.warn('Usando valor del BAC por defecto:', error)
    } finally {
      setLoadingExchangeRate(false)
    }
  }

  // Cargar propiedades
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'properties'))
        const propsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setProperties(propsList)
        if (propsList.length > 0) {
          setPropertyId(propsList[0].id)
        }
      } catch (error) {
        console.error('Error al cargar propiedades:', error)
      }
    }
    fetchProperties()
  }, [])

  // Cálculos de conversión en tiempo real
  const rawAmount = parseFloat(amountInput) || 0
  const rate = parseFloat(exchangeRate) || 458

  const amountCRC = currency === 'CRC' ? rawAmount : (rawAmount * rate)
  const amountUSD = currency === 'USD' ? rawAmount : (rawAmount / rate)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amountInput || !title || !propertyId) {
      alert('Por favor selecciona una propiedad, pon un título y un monto.')
      return
    }

    setLoading(true)
    setSuccess(false)

    try {
      let receiptUrl = ''

      if (file) {
        const fileRef = ref(storage, `receipts/${Date.now()}_${file.name}`)
        await uploadBytes(fileRef, file)
        receiptUrl = await getDownloadURL(fileRef)
      }

      await addDoc(collection(db, 'expenses'), {
        title,
        category,
        originalCurrency: currency,
        originalAmount: rawAmount,
        amountCRC: parseFloat(amountCRC.toFixed(2)),
        amountUSD: parseFloat(amountUSD.toFixed(2)),
        exchangeRateUsed: rate,
        propertyId,
        receiptUrl,
        status: 'paid_by_admin',
        createdAt: serverTimestamp(),
        date: new Date().toISOString().split('T')[0]
      })

      setTitle('')
      setAmountInput('')
      setFile(null)
      setSuccess(true)

      if (onExpenseAdded) onExpenseAdded()
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Error al guardar el gasto:', error)
      alert('Error al guardar el gasto en Firestore.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-slate-800 p-6 border border-slate-700 shadow-xl max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <PlusCircle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Registrar Nuevo Gasto / Servicio</h2>
          <p className="text-xs text-slate-400">Sube recibos de servicios o mantenimiento en ₡ o $</p>
        </div>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">
          <Check className="h-5 w-5" /> ¡Gasto registrado exitosamente!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selector de Propiedad */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">Seleccionar Casa / Propiedad</label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            {properties.length === 0 ? (
              <option value="">No hay casas registradas aún (Agrega una primero)</option>
            ) : (
              properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — Dueño: {p.ownerName}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Detalle y Categoría */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Detalle / Servicio</label>
            <input
              type="text"
              required
              placeholder="Ej. Recibo ICE, Cable, Mantenimiento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="Luz">Electricidad (ICE / Coopeguanacaste)</option>
              <option value="Agua">Agua (AyA / ASADA)</option>
              <option value="Internet">Internet / Cable</option>
              <option value="Jardinería">Jardín y Piscina</option>
              <option value="Reparaciones">Reparación / Mantenimiento</option>
              <option value="HOA">Cuota de Condominio (HOA)</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
        </div>

        {/* Moneda y Monto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Moneda del Gasto</label>
            <div className="flex rounded-xl bg-slate-900/60 p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setCurrency('CRC')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  currency === 'CRC' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Colones (₡ CRC)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  currency === 'USD' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Dólares ($ USD)
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
              placeholder={currency === 'CRC' ? 'Ej. 45000' : 'Ej. 120.50'}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tipo de Cambio y Conversión en Vivo */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Tipo de Cambio Venta BAC (₡ / $)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-sm font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={fetchBACExchangeRate}
                  title="Consultar indicador web"
                  className="px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingExchangeRate ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-right pt-2 md:pt-0">
              <div>
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Total Colones</span>
                <span className="text-sm font-bold text-white">
                  ₡ {amountCRC.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Total Dólares</span>
                <span className="text-sm font-bold text-emerald-400">
                  $ {amountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Subida de Comprobante */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">Comprobante / Recibo (Foto o PDF)</label>
          <div className="relative border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-emerald-500/50 transition-colors bg-slate-900/30">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <Upload className="h-6 w-6 text-slate-500" />
              <span className="text-xs">
                {file ? <strong className="text-emerald-400">{file.name}</strong> : 'Haz clic o arrastra la foto del recibo aquí'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || properties.length === 0}
          className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 transition-all hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Guardando gasto...' : 'Guardar Gasto'}
        </button>
      </form>
    </div>
  )
}