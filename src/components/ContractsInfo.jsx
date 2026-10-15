import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { Edit2, X, Check, Building, Search, CloudDownload, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { normalizeComparable } from '../utils/formValues'
import { readOfflineContracts, saveOfflineContracts } from '../utils/contractsOfflineStore'

export default function ContractsInfo() {
  const [properties, setProperties] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [editingProperty, setEditingProperty] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [usingOfflineCopy, setUsingOfflineCopy] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [loadError, setLoadError] = useState('')

  const fetchProperties = async () => {
    setSyncing(true)
    setLoadError('')
    try {
      const [propertySnapshot, clientSnapshot] = await Promise.all([
        getDocs(collection(db, 'properties')),
        getDocs(collection(db, 'clients')),
      ])
      const clientNames = new Map(clientSnapshot.docs.map(clientDoc => {
        const client = clientDoc.data()
        return [clientDoc.id, `${client.firstName || ''} ${client.lastName || ''}`.trim()]
      }))
      const list = propertySnapshot.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name || '',
          ownerName: clientNames.get(data.clientId) || data.ownerName || '',
          contractsInfo: data.contractsInfo || {},
        }
      }).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      const syncedAt = await saveOfflineContracts(list)
      setProperties(list)
      setLastSyncedAt(syncedAt)
      setUsingOfflineCopy(false)
      setIsOnline(true)
    } catch (error) {
      console.error('Error al sincronizar contratos:', error)
      setIsOnline(false)
      setUsingOfflineCopy(true)
      try {
        const cached = await readOfflineContracts()
        setProperties(cached.properties.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })))
        setLastSyncedAt(cached.syncedAt)
        setLoadError(cached.properties.length ? '' : 'No hay una copia offline. Conéctate a internet y sincroniza esta sección primero.')
      } catch (cacheError) {
        console.error('Error al leer la copia offline:', cacheError)
        setLoadError('No se pudo cargar la información guardada en este dispositivo.')
      }
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  useEffect(() => {
    let active = true
    const loadContracts = async () => {
      try {
        const cached = await readOfflineContracts()
        if (active && cached.properties.length) {
          setProperties(cached.properties.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })))
          setLastSyncedAt(cached.syncedAt)
          setUsingOfflineCopy(true)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error al leer la copia offline:', error)
      }
      if (active && navigator.onLine) await fetchProperties()
      else if (active) {
        setIsOnline(false)
        setUsingOfflineCopy(true)
        setLoading(false)
      }
    }
    const handleOnline = () => {
      setIsOnline(true)
      fetchProperties()
    }
    const handleOffline = () => {
      setIsOnline(false)
      setUsingOfflineCopy(true)
      setEditingProperty(null)
    }
    loadContracts()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      active = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!editingProperty || !isOnline || usingOfflineCopy) return

    try {
      const docRef = doc(db, 'properties', editingProperty.id)
      await updateDoc(docRef, {
        contractsInfo: editingProperty.contractsInfo || {}
      })
      setEditingProperty(null)
      await fetchProperties()
    } catch (error) {
      console.error('Error al guardar contratos:', error)
      alert('No se pudo guardar la información de contratos.')
    }
  }

  const filteredProperties = properties.filter(property => {
    const contracts = property.contractsInfo || {}
    return normalizeComparable([
      property.name, property.ownerName, ...Object.values(contracts),
    ].join(' ')).includes(normalizeComparable(searchTerm))
  })

  const syncLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', dateStyle: 'medium', timeStyle: 'short' })
    : 'Sin copia guardada'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-white">Contratos y Servicios por Propiedad</h2>
          <p className="text-xs text-slate-400">Solo lectura offline · última sincronización: {syncLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs ${isOnline && !usingOfflineCopy ? 'text-emerald-400' : 'text-amber-300'}`}>
            {isOnline && !usingOfflineCopy ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline && !usingOfflineCopy ? 'Con conexión' : 'Copia offline'}
          </span>
          <button
            type="button"
            onClick={fetchProperties}
            disabled={!isOnline || syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500 disabled:opacity-50"
          >
            {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            Actualizar copia
          </button>
        </div>
      </div>

      {usingOfflineCopy && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          Estás viendo una copia guardada en este dispositivo. Es de solo lectura y puede no incluir cambios recientes.
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="border-b border-slate-700 p-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar casa, cliente o servicio..."
              aria-label="Buscar contratos"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-400">Cargando contratos...</p>
        ) : loadError ? (
          <p className="p-6 text-center text-sm text-amber-200">{loadError}</p>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredProperties.map(property => {
              const c = property.contractsInfo || {}
              return (
                <section key={property.id} className="p-4 md:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-white">{property.name || 'Casa sin nombre'}</h3>
                      {property.ownerName && <p className="truncate text-xs text-slate-400">{property.ownerName}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingProperty(JSON.parse(JSON.stringify(property)))}
                      disabled={!isOnline || usingOfflineCopy}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      title={!isOnline || usingOfflineCopy ? 'Disponible cuando vuelva la conexión' : 'Editar contratos'}
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Editar
                    </button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-xs sm:grid-cols-3 xl:grid-cols-5">
                    <div><dt className="mb-1 font-semibold text-emerald-300">Internet</dt><dd className="text-slate-200">{c.internetCompany || 'Sin compañía'}</dd><dd className="mt-0.5 wrap-break-word font-mono text-slate-400">N°: {c.internetContract || 'N/A'}</dd></div>
                    <div><dt className="mb-1 font-semibold text-emerald-300">Servicios básicos</dt><dd className="text-slate-200">Electricidad: {c.electricity || 'N/A'}</dd><dd className="mt-0.5 text-slate-200">Agua: {c.water || 'N/A'}</dd></div>
                    <div><dt className="mb-1 font-semibold text-emerald-300">Mantenimiento</dt><dd className="text-slate-200">Piscina: {c.poolMaint || 'N/A'}</dd><dd className="mt-0.5 text-slate-200">Jardín: {c.gardenMaint || 'N/A'}</dd></div>
                    <div><dt className="mb-1 font-semibold text-emerald-300">ACCT / HOA</dt><dd className="text-slate-200">ACCT: {c.acct || 'N/A'}</dd><dd className="mt-0.5 text-slate-200">HOA: {c.hoa || 'N/A'}</dd></div>
                    <div><dt className="mb-1 font-semibold text-emerald-300">Seguro / Administración</dt><dd className="text-slate-200">Seguro: {c.insurance || 'N/A'}</dd><dd className="mt-0.5 text-slate-200">Administración: {c.management || 'N/A'}</dd></div>
                  </dl>
                </section>
              )
            })}
            {filteredProperties.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No hay propiedades que coincidan con la búsqueda.</p>}
          </div>
        )}
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

    </div>
  )
}