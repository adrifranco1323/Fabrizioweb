import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { Home, Plus, Edit2, Trash2, X, UserPlus, KeyRound, RefreshCw, Copy } from 'lucide-react'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O/1/I para evitar confusiones

function generateAccessCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export default function PropertiesList() {
  const [properties, setProperties] = useState([])
  const [clients, setClients] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', phone: '', email: '', cars: '' })

  const [selectedProperty, setSelectedProperty] = useState(null)
  const [editingId, setEditingId] = useState(null)

  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [accessCode, setAccessCode] = useState('')
  
  const [alarmCode, setAlarmCode] = useState('')
  const [mainDoorCode, setMainDoorCode] = useState('')
  const [garageCode, setGarageCode] = useState('')
  const [epassUser, setEpassUser] = useState('')
  const [epassPw, setEpassPw] = useState('')
  const [membersNum, setMembersNum] = useState('')

  const [corpCed, setCorpCed] = useState('')
  const [corpName, setCorpName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')

  const fetchData = async () => {
    try {
      const propQuery = query(collection(db, 'properties'), orderBy('name', 'asc'))
      const propSnap = await getDocs(propQuery)
      setProperties(propSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      const clientQuery = query(collection(db, 'clients'), orderBy('firstName', 'asc'))
      const clientSnap = await getDocs(clientQuery)
      setClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error("Error al cargar datos:", error)
    }
  }

  useEffect(() => { fetchData() }, [])

  const resetForm = () => {
    setName('')
    setClientId('')
    setAccessCode(generateAccessCode())
    setAlarmCode('')
    setMainDoorCode('')
    setGarageCode('')
    setEpassUser('')
    setEpassPw('')
    setMembersNum('')
    setCorpCed('')
    setCorpName('')
    setBillingEmail('')
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    resetForm()
    setIsModalOpen(true)
  }

  const handleOpenEdit = (p) => {
    setEditingId(p.id)
    setName(p.name || '')
    setClientId(p.clientId || '')
    setAccessCode(p.accessCode || generateAccessCode())
    setAlarmCode(p.alarmCode || '')
    setMainDoorCode(p.mainDoorCode || '')
    setGarageCode(p.garageCode || '')
    setEpassUser(p.epassUser || '')
    setEpassPw(p.epassPw || '')
    setMembersNum(p.membersNum || '')
    setCorpCed(p.corpCed || '')
    setCorpName(p.corpName || '')
    setBillingEmail(p.billingEmail || '')
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    const normalizedCode = accessCode.trim().toUpperCase()
    if (!normalizedCode) {
      alert('El código de acceso es obligatorio.')
      return
    }
    const codeTaken = properties.some(p => p.id !== editingId && (p.accessCode || '').toUpperCase() === normalizedCode)
    if (codeTaken) {
      alert('Ese código de acceso ya está en uso por otra casa. Genera uno nuevo.')
      return
    }

    const payload = {
      name: name ? name.trim() : '',
      clientId: clientId || '',
      accessCode: normalizedCode,
      alarmCode: alarmCode ? alarmCode.trim() : '',
      mainDoorCode: mainDoorCode ? mainDoorCode.trim() : '',
      garageCode: garageCode ? garageCode.trim() : '',
      epassUser: epassUser ? epassUser.trim() : '',
      epassPw: epassPw ? epassPw.trim() : '',
      membersNum: membersNum ? membersNum.trim() : '',
      corpCed: corpCed ? corpCed.trim() : '',
      corpName: corpName ? corpName.trim() : '',
      billingEmail: billingEmail ? billingEmail.trim() : ''
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'properties', editingId), payload)
      } else {
        payload.createdAt = serverTimestamp()
        await addDoc(collection(db, 'properties'), payload)
      }
      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      console.error("Error al guardar propiedad:", error)
      alert("Hubo un error al guardar la propiedad. Revisa la consola.")
    }
  }

  const handleQuickClientSave = async (e) => {
    e.preventDefault()
    if (!newClient.firstName.trim()) return

    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        firstName: newClient.firstName.trim(),
        lastName: newClient.lastName.trim(),
        phone: newClient.phone.trim(),
        email: newClient.email.trim(),
        cars: newClient.cars.trim()
      })

      const clientQuery = query(collection(db, 'clients'), orderBy('firstName', 'asc'))
      const clientSnap = await getDocs(clientQuery)
      setClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setClientId(docRef.id)

      setNewClient({ firstName: '', lastName: '', phone: '', email: '', cars: '' })
      setIsClientModalOpen(false)
    } catch (error) {
      console.error('Error al crear cliente rápido:', error)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('¿Seguro que deseas eliminar esta casa?')) {
      try {
        await deleteDoc(doc(db, 'properties', id))
        fetchData()
      } catch (error) {
        console.error("Error al eliminar:", error)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-white">Gestión de Casas y Villas</h2>
          <p className="text-xs text-slate-400">Listado en orden alfabético</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        >
          <Plus className="h-4 w-4" /> Agregar Casa
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 text-xs border-b border-slate-700">
              <th className="p-3">Propiedad</th>
              <th className="p-3 hidden md:table-cell">Cliente Asociado</th>
              <th className="p-3 hidden md:table-cell">Corporativo / Facturación</th>
              <th className="p-3">Código Propietario</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700 text-sm">
            {properties.map(p => {
              const assignedClient = clients.find(c => c.id === p.clientId)
              return (
                <tr key={p.id} className="hover:bg-slate-750">
                  <td className="p-3">
                    <div className="font-semibold text-white">{p.name}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs text-slate-300">
                    <div className="font-medium text-white">{assignedClient ? `${assignedClient.firstName} ${assignedClient.lastName}` : 'Sin cliente'}</div>
                    <div className="text-slate-400">{assignedClient?.email || ''}</div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs text-slate-300">
                    <div className="font-medium text-white">{p.corpName || 'Persona Física'}</div>
                    <div className="text-slate-400">Factura: {p.billingEmail || assignedClient?.email || 'N/A'}</div>
                  </td>
                  <td className="p-3">
                    <span className="font-mono font-bold text-cyan-400 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs">{p.accessCode || 'N/A'}</span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <button onClick={() => { setSelectedProperty(p); setIsDetailsOpen(true); }} className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-cyan-400">Detalles</button>
                    <button onClick={() => handleOpenEdit(p)} className="p-1 text-amber-400 hover:bg-slate-700 rounded"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1 text-red-400 hover:bg-slate-700 rounded"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base">{editingId ? 'Editar Casa' : 'Registrar Nueva Casa'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <p className="font-bold text-emerald-400 mb-2">Información General</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1">Nombre de la Casa / Villa</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Villa Sol" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-bold text-emerald-400">Seleccionar Cliente</label>
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(true)}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> + Nuevo Cliente
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                  >
                    <option value="">Seleccione un cliente...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email || 'Sin correo'})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-3">
                <p className="font-bold text-emerald-400 mb-2 flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Acceso del Propietario</p>
                <p className="text-slate-400 mb-2">Comparte este código con el dueño para que pueda ver el estado de cuenta de esta casa.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={accessCode}
                    onChange={e => setAccessCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm font-mono font-bold tracking-widest text-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setAccessCode(generateAccessCode())}
                    title="Generar nuevo código"
                    className="p-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(accessCode)}
                    title="Copiar código"
                    className="p-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-3">
                <p className="font-bold text-emerald-400 mb-2">Códigos y Accesos</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1">Código Alarma</label>
                    <input type="text" value={alarmCode} onChange={e => setAlarmCode(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Código Puerta Principal</label>
                    <input type="text" value={mainDoorCode} onChange={e => setMainDoorCode(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Código Puerta Garaje</label>
                    <input type="text" value={garageCode} onChange={e => setGarageCode(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">EPASS USER</label>
                    <input type="text" value={epassUser} onChange={e => setEpassUser(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">EPASS PW</label>
                    <input type="text" value={epassPw} onChange={e => setEpassPw(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">MEMBERS #</label>
                    <input type="text" value={membersNum} onChange={e => setMembersNum(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-3">
                <p className="font-bold text-emerald-400 mb-2">Datos Corporativos y Facturación</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1">Corp. Name</label>
                    <input type="text" value={corpName} onChange={e => setCorpName(e.target.value)} placeholder="Nombre Empresa" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Corp. Cédula Jurídica</label>
                    <input type="text" value={corpCed} onChange={e => setCorpCed(e.target.value)} placeholder="3-101-..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Billing Email</label>
                    <input type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} placeholder="facturacion@..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white" />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3 rounded-xl text-sm mt-4">Guardar Propiedad</button>
            </form>
          </div>
        </div>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-2xl text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h3 className="font-bold text-white text-sm">Nuevo Cliente Rápido</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-white"><X className="h-4 w-4"/></button>
            </div>
            <form onSubmit={handleQuickClientSave} className="space-y-2">
              <div>
                <label className="text-slate-300 block mb-1">Nombre</label>
                <input type="text" required value={newClient.firstName} onChange={e => setNewClient({...newClient, firstName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Apellidos</label>
                <input type="text" value={newClient.lastName} onChange={e => setNewClient({...newClient, lastName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Teléfono</label>
                <input type="text" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Correos (Ej. a@... / b@...)</label>
                <input type="text" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs" />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Placas de Carros (CARS)</label>
                <input type="text" value={newClient.cars} onChange={e => setNewClient({...newClient, cars: e.target.value})} placeholder="Ej. BST193" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-cyan-300 font-mono text-xs" />
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-xl text-xs mt-2">Guardar y Seleccionar</button>
            </form>
          </div>
        </div>
      )}

      {isDetailsOpen && selectedProperty && (() => {
        const cDetails = clients.find(c => c.id === selectedProperty.clientId)
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                <h3 className="font-bold text-white text-base">Detalles: {selectedProperty.name}</h3>
                <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
              </div>
              
              <div className="space-y-3 text-slate-300">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <p><strong>Cliente:</strong> {cDetails ? `${cDetails.firstName} ${cDetails.lastName}` : 'No asignado'}</p>
                  <p><strong>Teléfono Cliente:</strong> {cDetails?.phone || 'N/A'}</p>
                  <p><strong>Correo(s) Cliente:</strong> {cDetails?.email || 'N/A'}</p>
                  <p><strong>Vehículos (CARS):</strong> {cDetails?.cars || 'N/A'}</p>
                  <p><strong>Código Propietario:</strong> <span className="font-mono font-bold text-cyan-400">{selectedProperty.accessCode || 'N/A'}</span></p>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <p className="font-semibold text-emerald-400 mb-1">Códigos y Accesos</p>
                  <p><strong>Código Alarma:</strong> {selectedProperty.alarmCode || 'N/A'}</p>
                  <p><strong>Puerta Principal:</strong> {selectedProperty.mainDoorCode || 'N/A'}</p>
                  <p><strong>Puerta Garaje:</strong> {selectedProperty.garageCode || 'N/A'}</p>
                  <p><strong>EPASS USER / PW:</strong> {selectedProperty.epassUser || 'N/A'} / {selectedProperty.epassPw || 'N/A'}</p>
                  <p><strong>MEMBERS #:</strong> {selectedProperty.membersNum || 'N/A'}</p>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <p className="font-semibold text-emerald-400 mb-1">Facturación y Corporativo</p>
                  <p><strong>Corp. Name:</strong> {selectedProperty.corpName || 'N/A'}</p>
                  <p><strong>Corp. Cédula:</strong> {selectedProperty.corpCed || 'N/A'}</p>
                  <p><strong>Billing Email:</strong> {selectedProperty.billingEmail || 'N/A'}</p>
                </div>
              </div>

              <button onClick={() => setIsDetailsOpen(false)} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-xl text-sm">Cerrar</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}