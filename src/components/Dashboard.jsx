import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { Building2, DollarSign, CreditCard, FileText, ExternalLink, Calendar, Filter } from 'lucide-react'

export default function Dashboard() {
  const [properties, setProperties] = useState([])
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  // Cargar propiedades
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'properties'))
        const propsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setProperties(propsList)
        if (propsList.length > 0) {
          setSelectedPropertyId(propsList[0].id)
        }
      } catch (error) {
        console.error('Error al cargar propiedades:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProperties()
  }, [])

  // Cargar gastos de la propiedad seleccionada
  useEffect(() => {
    if (!selectedPropertyId) return

    const fetchExpenses = async () => {
      setLoading(true)
      try {
        const q = query(
          collection(db, 'expenses'),
          where('propertyId', '==', selectedPropertyId)
        )
        const querySnapshot = await getDocs(q)
        const expensesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setExpenses(expensesList)
      } catch (error) {
        console.error('Error al cargar gastos:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchExpenses()
  }, [selectedPropertyId])

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  // Métricas financieras
  const reserveFundUSD = selectedProperty ? parseFloat(selectedProperty.reserveFundUSD || 0) : 0
  
  const totalSpentUSD = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amountUSD) || 0), 0)
  const totalSpentCRC = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amountCRC) || 0), 0)
  
  const balanceUSD = reserveFundUSD - totalSpentUSD

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Selector de Propiedad */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Dashboard de Propiedad</h2>
            <p className="text-xs text-slate-400">Resumen financiero y control de gastos</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.ownerName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tarjetas de Métricas (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Fondo de Reserva */}
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/60 shadow-md">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Fondo de Reserva</span>
            <DollarSign className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            $ {reserveFundUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Presupuesto asignado</span>
        </div>

        {/* Total Gastado */}
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/60 shadow-md">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Gastos Acumulados</span>
            <CreditCard className="h-5 w-5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            $ {totalSpentUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Eqv: ₡ {totalSpentCRC.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Saldo Disponible */}
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/60 shadow-md">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Saldo Restante</span>
            <Building2 className={`h-5 w-5 ${balanceUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
          </div>
          <div className={`text-2xl font-black ${balanceUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            $ {balanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {balanceUSD >= 0 ? 'A favor de la propiedad' : 'Superó el fondo de reserva'}
          </span>
        </div>
      </div>

      {/* Tabla de Gastos Registrados */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-400" /> Detalle de Servicios y Gastos
          </h3>
          <span className="text-xs text-slate-400">{expenses.length} registros</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando datos...</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No hay gastos registrados para esta propiedad aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Detalle / Servicio</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Monto Original</th>
                  <th className="py-3 px-4">Monto CRC (₡)</th>
                  <th className="py-3 px-4">Monto USD ($)</th>
                  <th className="py-3 px-4 text-center">Recibo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {expense.date || 'N/A'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">{expense.title}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700 text-slate-300 border border-slate-600">
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200">
                      {expense.originalCurrency === 'CRC' ? '₡' : '$'} {expense.originalAmount?.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      ₡ {expense.amountCRC?.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-400">
                      $ {expense.amountUSD?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {expense.receiptUrl ? (
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline font-medium"
                        >
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Sin foto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}