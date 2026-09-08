import { useState } from 'react'
import { db } from '../firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { Home, Plus, Check } from 'lucide-react'

export default function PropertyForm({ onPropertyAdded }) {
  const [propertyName, setPropertyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [reserveFundUSD, setReserveFundUSD] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!propertyName || !ownerName) return

    setLoading(true)
    setSuccess(false)

    try {
      await addDoc(collection(db, 'properties'), {
        name: propertyName,
        ownerName,
        ownerEmail,
        reserveFundUSD: parseFloat(reserveFundUSD) || 0,
        createdAt: serverTimestamp()
      })

      setPropertyName('')
      setOwnerName('')
      setOwnerEmail('')
      setReserveFundUSD('')
      setSuccess(true)

      if (onPropertyAdded) onPropertyAdded()
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Error al agregar casa:', error)
      alert('Error al guardar la propiedad en Firestore.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-slate-800 p-6 border border-slate-700 shadow-xl max-w-2xl mx-auto mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <Home className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Registrar Nueva Casa / Propiedad</h2>
          <p className="text-xs text-slate-400">Agrega las casas que administras y asigna su propietario</p>
        </div>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">
          <Check className="h-5 w-5" /> ¡Propiedad guardada exitosamente!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Nombre de la Casa / Villa</label>
            <input
              type="text"
              required
              placeholder="Ej. Casa Sol & Mar - Papagayo"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Nombre del Propietario</label>
            <input
              type="text"
              required
              placeholder="Ej. John Smith / Carlos Araya"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Correo del Propietario (Opcional)</label>
            <input
              type="email"
              placeholder="dueno@email.com"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Fondo de Reserva Inicial (USD)</label>
            <input
              type="number"
              placeholder="$ 500"
              value={reserveFundUSD}
              onChange={(e) => setReserveFundUSD(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 transition-all hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          {loading ? 'Guardando...' : 'Guardar Propiedad'}
        </button>
      </form>
    </div>
  )
}