import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore'
import { Users, Plus, Edit2, Trash2, X } from 'lucide-react'

export default function ProvidersList({ role }) {
  const [providers, setProviders] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [category, setCategory] = useState('')
  const [bank, setBank] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [iban, setIban] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const fetchProviders = async () => {
    const snap = await getDocs(collection(db, 'providers'))
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }))
    setProviders(list)
  }

  useEffect(() => { fetchProviders() }, [])

  const handleOpenCreate = () => {
    setEditingId(null)
    setName('')
    setContactName('')
    setCategory('')
    setBank('')
    setCurrency('USD')
    setIban('')
    setPhone('')
    setEmail('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (p) => {
    setEditingId(p.id)
    setName(p.name || '')
    setContactName(p.contactName || '')
    setCategory(p.category || '')
    setBank(p.bank || '')
    setCurrency(p.currency || 'USD')
    setIban(p.iban || '')
    setPhone(p.phone || '')
    setEmail(p.email || '')
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const payload = { name, contactName, category, bank, currency, iban, phone, email }
    if (editingId) {
      await updateDoc(doc(db, 'providers', editingId), payload)
      await setDoc(doc(db, 'providerDirectory', editingId), { name: name.trim() }, { merge: true })
    } else {
      const providerRef = await addDoc(collection(db, 'providers'), payload)
      await setDoc(doc(db, 'providerDirectory', providerRef.id), { name: name.trim() })
    }
    setIsModalOpen(false)
    fetchProviders()
  }

  const handleDelete = async (id) => {
    if (confirm('¿Deseas eliminar este proveedor?')) {
      await deleteDoc(doc(db, 'providers', id))
      await deleteDoc(doc(db, 'providerDirectory', id))
      fetchProviders()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-white">Directorio de Proveedores</h2>
          <p className="text-xs text-slate-400">Proveedores, cuentas bancarias, IBAN y datos de contacto</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        >
          <Plus className="h-4 w-4" /> Agregar Proveedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map(p => (
          <div key={p.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs bg-slate-900 text-emerald-400 px-2 py-0.5 rounded border border-slate-700">{p.category || 'General'}</span>
                <div className="space-x-1">
                  <button onClick={() => handleOpenEdit(p)} className="p-1 text-amber-400 hover:bg-slate-700 rounded"><Edit2 className="h-3.5 w-3.5" /></button>
                  {role === 'admin' && <button onClick={() => handleDelete(p.id)} className="p-1 text-red-400 hover:bg-slate-700 rounded"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
              <h3 className="font-bold text-base text-white">{p.name || 'Sin Empresa'}</h3>
              {p.contactName && <p className="text-xs text-slate-400">Contacto: {p.contactName}</p>}
              <div className="flex gap-2 text-xs">
                <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300 border border-slate-700">Banco: {p.bank || 'N/A'}</span>
                <span className="bg-slate-900 px-2 py-0.5 rounded text-emerald-300 border border-slate-700">{p.currency || 'USD'}</span>
              </div>
              <p className="text-xs font-mono bg-slate-900 p-2 rounded border border-slate-700 text-slate-300 truncate">
                IBAN: {p.iban || 'Sin IBAN'}
              </p>
            </div>
            <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-700/50">
              <p>📞 {p.phone || 'N/A'}</p>
              <p>✉️ {p.email || 'N/A'}</p>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-base">{editingId ? 'Editar Proveedor' : 'Registrar Proveedor'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Empresa / Nombre Comercial</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Mr. Solutions" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-300 block mb-1">Nombre de Contacto</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Ej. Rafael Montano" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Banco</label>
                  <input type="text" value={bank} onChange={e => setBank(e.target.value)} placeholder="BCR, BAC..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Moneda</label>
                  <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="USD" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-300 block mb-1">Cuenta IBAN</label>
                <input type="text" value={iban} onChange={e => setIban(e.target.value)} placeholder="CR..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 font-mono text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Teléfono</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Correo</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-white" />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 rounded-xl text-sm mt-2">Guardar Proveedor</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}