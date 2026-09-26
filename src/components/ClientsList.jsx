import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { Contact, Plus, Edit2, Trash2, X, Car } from 'lucide-react'

export default function ClientsList() {
  const [clients, setClients] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [lp, setLp] = useState('')
  const [cars, setCars] = useState('')

  const fetchClients = async () => {
    // Ordenado alfabéticamente por nombre
    const q = query(collection(db, 'clients'), orderBy('firstName', 'asc'))
    const snap = await getDocs(q)
    setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => { fetchClients() }, [])

  const handleOpenCreate = () => {
    setEditingId(null)
    setFirstName('')
    setLastName('')
    setPhone('')
    setEmail('')
    setLp('')
    setCars('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (c) => {
    setEditingId(c.id)
    setFirstName(c.firstName || '')
    setLastName(c.lastName || '')
    setPhone(c.phone || '')
    setEmail(c.email || '')
    setLp(c.lp || '')
    setCars(c.cars || '')
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(), // Permite varios correos ej: correo1@... / correo2@...
      lp: lp.trim(),
      cars: cars.trim()
    }

    if (editingId) {
      await updateDoc(doc(db, 'clients', editingId), payload)
    } else {
      await addDoc(collection(db, 'clients'), payload)
    }
    setIsModalOpen(false)
    fetchClients()
  }

  const handleDelete = async (id) => {
    if (confirm('¿Seguro que deseas eliminar este cliente?')) {
      await deleteDoc(doc(db, 'clients', id))
      fetchClients()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-white">Directorio de Clientes</h2>
          <p className="text-xs text-slate-400">Orden alfabético automático, teléfonos, múltiples correos y placas</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        >
          <Plus className="h-4 w-4" /> Agregar Cliente
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 uppercase tracking-wider border-b border-slate-700">
              <th className="p-3">Nombre y Apellidos</th>
              <th className="p-3 hidden md:table-cell">Teléfono</th>
              <th className="p-3 hidden md:table-cell">Correos Electrónicos</th>
              <th className="p-3 hidden md:table-cell">LP</th>
              <th className="p-3">Vehículos (CARS)</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {clients.map(c => (
              <tr key={c.id} className="hover:bg-slate-750">
                <td className="p-3 font-semibold text-white text-sm">
                  {c.firstName} {c.lastName}
                </td>
                <td className="p-3 hidden md:table-cell text-slate-300">{c.phone || 'N/A'}</td>
                <td className="p-3 hidden md:table-cell text-slate-300">{c.email || 'N/A'}</td>
                <td className="p-3 hidden md:table-cell text-slate-300">{c.lp || 'N/A'}</td>
                <td className="p-3 text-cyan-400 font-mono">
                  {c.cars ? (
                    <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {c.cars}</span>
                  ) : (
                    <span className="text-slate-500">Sin vehículos</span>
                  )}
                </td>
                <td className="p-3 text-right space-x-1">
                  <button onClick={() => { setSelectedClient(c); setIsDetailsOpen(true); }} className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-cyan-400">Detalles</button>
                  <button onClick={() => handleOpenEdit(c)} className="p-1 text-amber-400 hover:bg-slate-700 rounded"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1 text-red-400 hover:bg-slate-700 rounded"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base">{editingId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Nombres</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ej. Kimberly" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Apellidos</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Ej. George" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Teléfono</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 ..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Correos (Puedes separar varios con " / ")</label>
                <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo1@... / correo2@..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">LP (Permiso / Licencia)</label>
                <input type="text" value={lp} onChange={e => setLp(e.target.value)} placeholder="Referencia LP" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Placas de Carros (CARS)</label>
                <input type="text" value={cars} onChange={e => setCars(e.target.value)} placeholder="Ej. VE2859 / ABC123" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-cyan-300 font-mono" />
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 rounded-xl text-sm mt-2">Guardar Cliente</button>
            </form>
          </div>
        </div>
      )}

      {isDetailsOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base">{selectedClient.firstName} {selectedClient.lastName}</h3>
              <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-700/50 space-y-1 text-slate-300">
              <p><strong>Teléfono:</strong> {selectedClient.phone || 'N/A'}</p>
              <p><strong>Correos:</strong> {selectedClient.email || 'N/A'}</p>
              <p><strong>LP:</strong> {selectedClient.lp || 'N/A'}</p>
              <p><strong>Vehículos (CARS):</strong> {selectedClient.cars || 'N/A'}</p>
            </div>
            <button onClick={() => setIsDetailsOpen(false)} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-xl text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}