import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { FileText, Edit2, X, Check, Building } from 'lucide-react'

export default function ContractsInfo() {
  const [properties, setProperties] = useState([])
  const [editingProperty, setEditingProperty] = useState(null)
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const fetchProperties = async () => {
    const snap = await getDocs(collection(db, 'properties'))
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }))
    setProperties(list)
  }

  useEffect(() => { fetchProperties() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!editingProperty) return

    try {
      const docRef = doc(db, 'properties', editingProperty.id)
      await updateDoc(docRef, {
        contractsInfo: editingProperty.contractsInfo || {}
      })
      setEditingProperty(null)
      fetchProperties()
    } catch (error) {
      console.error('Error al guardar contratos:', error)
      alert('No se pudo guardar la información de contratos.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-white">Contratos y Servicios por Propiedad</h2>
          <p className="text-xs text-slate-400">Gestión de internet, medidores, HOA, seguros y mantenimientos</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <th className="p-3">Casa / Cliente</th>
                <th className="p-3">Internet</th>
                <th className="p-3 hidden md:table-cell">Electricidad / Agua</th>
                <th className="p-3 hidden md:table-cell">Mant. Piscina / Jardín</th>
                <th className="p-3 hidden md:table-cell">ACCT / HOA / Ins. / Mgmt</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {properties.map(p => {
                const c = p.contractsInfo || {}
                return (
                  <tr key={p.id} className="hover:bg-slate-750">
                    <td className="p-3">
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      <div className="text-slate-400">{p.ownerName}</div>
                    </td>
                    <td className="p-3 text-slate-300">
                      <div>{c.internetCompany || 'Sin compañía'}</div>
                      <div className="text-slate-500 font-mono">N°: {c.internetContract || 'N/A'}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-slate-300">
                      <div>⚡ Elec: {c.electricity || 'N/A'}</div>
                      <div>💧 Agua: {c.water || 'N/A'}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-slate-300">
                      <div>🏊 Piscina: {c.poolMaint || 'N/A'}</div>
                      <div>🌿 Jardín: {c.gardenMaint || 'N/A'}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-slate-300 space-y-0.5">
                      <div>ACCT: {c.acct || 'N/A'}</div>
                      <div>HOA: {c.hoa || 'N/A'}</div>
                      <div>Ins: {c.insurance || 'N/A'}</div>
                      <div>Mgmt: {c.management || 'N/A'}</div>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => { setSelectedProperty(p); setIsDetailsOpen(true); }}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-cyan-400"
                      >
                        Detalles
                      </button>
                      <button
                        onClick={() => setEditingProperty(JSON.parse(JSON.stringify(p)))}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg font-semibold inline-flex items-center gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edición de Contratos */}
      {editingProperty && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building className="h-4 w-4 text-emerald-400" /> Contratos: {editingProperty.name}
              </h3>
              <button onClick={() => setEditingProperty(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <p className="font-bold text-emerald-400 mb-1">Internet</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Compañía Internet"
                    value={editingProperty.contractsInfo?.internetCompany || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, internetCompany: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Contrato Internet"
                    value={editingProperty.contractsInfo?.internetContract || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, internetContract: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <p className="font-bold text-emerald-400 mb-1">Servicios Básicos</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Medidor Electricidad"
                    value={editingProperty.contractsInfo?.electricity || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, electricity: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Medidor Agua"
                    value={editingProperty.contractsInfo?.water || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, water: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <p className="font-bold text-emerald-400 mb-1">Mantenimientos</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Mantenimiento Piscina"
                    value={editingProperty.contractsInfo?.poolMaint || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, poolMaint: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Mantenimiento Jardines"
                    value={editingProperty.contractsInfo?.gardenMaint || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, gardenMaint: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <p className="font-bold text-emerald-400 mb-1">Cuentas, Cuotas y Pólizas</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="ACCT"
                    value={editingProperty.contractsInfo?.acct || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, acct: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="HOA"
                    value={editingProperty.contractsInfo?.hoa || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, hoa: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Insurance"
                    value={editingProperty.contractsInfo?.insurance || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, insurance: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Management"
                    value={editingProperty.contractsInfo?.management || ''}
                    onChange={e => setEditingProperty({
                      ...editingProperty,
                      contractsInfo: { ...editingProperty.contractsInfo, management: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 rounded-xl text-xs mt-2 flex items-center justify-center gap-1"
              >
                <Check className="h-4 w-4" /> Guardar Contratos y Servicios
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalles (solo lectura) */}
      {isDetailsOpen && selectedProperty && (() => {
        const c = selectedProperty.contractsInfo || {}
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Building className="h-4 w-4 text-emerald-400" /> Detalles: {selectedProperty.name}
                </h3>
                <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
              </div>

              <div className="space-y-3 text-slate-300">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <p className="font-semibold text-emerald-400 mb-1">Internet</p>
                  <p><strong>Compañía:</strong> {c.internetCompany || 'N/A'}</p>
                  <p><strong>N° Contrato:</strong> {c.internetContract || 'N/A'}</p>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <p className="font-semibold text-emerald-400 mb-1">Servicios Básicos</p>
                  <p>⚡ Electricidad: {c.electricity || 'N/A'}</p>
                  <p>💧 Agua: {c.water || 'N/A'}</p>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <p className="font-semibold text-emerald-400 mb-1">Mantenimientos</p>
                  <p>🏊 Piscina: {c.poolMaint || 'N/A'}</p>
                  <p>🌿 Jardín: {c.gardenMaint || 'N/A'}</p>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <p className="font-semibold text-emerald-400 mb-1">Cuentas, Cuotas y Pólizas</p>
                  <p><strong>ACCT:</strong> {c.acct || 'N/A'}</p>
                  <p><strong>HOA:</strong> {c.hoa || 'N/A'}</p>
                  <p><strong>Insurance:</strong> {c.insurance || 'N/A'}</p>
                  <p><strong>Management:</strong> {c.management || 'N/A'}</p>
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