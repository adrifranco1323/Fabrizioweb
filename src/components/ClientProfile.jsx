import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, doc, getDoc, setDoc, query, where, deleteDoc } from 'firebase/firestore'
import { Users, Cake, Save, Plus, Trash2, Home, Check } from 'lucide-react'

const RELATIONSHIPS = ['Husband', 'Wife', 'Son', 'Daughter', 'Brother', 'Sister', 'Other']
const RELATIONSHIP_LABELS_ES = {
  Husband: 'Esposo',
  Wife: 'Esposa',
  Son: 'Hijo',
  Daughter: 'Hija',
  Brother: 'Hermano',
  Sister: 'Hermana',
  Other: 'Otro',
}

export default function ClientProfile({ role, ownerPropertyId }) {
  const isOwnerView = role === 'owner'
  const [properties, setProperties] = useState([])
  const [propertyId, setPropertyId] = useState(ownerPropertyId || '')
  const [property, setProperty] = useState(null)

  const [familySize, setFamilySize] = useState(1)
  const [ownerBirthday, setOwnerBirthday] = useState('')
  const [ownerNotes, setOwnerNotes] = useState('')
  const [members, setMembers] = useState([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (ownerPropertyId) return
    const fetchProperties = async () => {
      try {
        const snap = await getDocs(collection(db, 'propertyStatementDirectory'))
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }))
        setProperties(list)
      } catch (error) {
        console.error('Error al cargar las propiedades:', error)
      }
    }
    fetchProperties()
  }, [ownerPropertyId])

  useEffect(() => {
    const loadProfile = async () => {
      if (!propertyId) {
        setProperty(null)
        setFamilySize(1)
        setOwnerBirthday('')
        setOwnerNotes('')
        setMembers([])
        return
      }
      setLoading(true)
      try {
        const propSnap = await getDoc(doc(db, 'propertyStatementDirectory', propertyId))
        setProperty(propSnap.exists() ? { id: propSnap.id, ...propSnap.data() } : null)

        const profileSnap = await getDoc(doc(db, 'clientProfiles', propertyId))
        if (profileSnap.exists()) {
          const data = profileSnap.data()
          setFamilySize(data.familySize || 1)
          setOwnerBirthday(data.ownerBirthday || '')
          setOwnerNotes(data.ownerNotes || '')
          setMembers(data.members || [])
        } else {
          setFamilySize(1)
          setOwnerBirthday('')
          setOwnerNotes('')
          setMembers([])
        }
      } catch (error) {
        console.error('Error al cargar la informaci\u00f3n del cliente:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [propertyId])

  const handleFamilySizeChange = (value) => {
    const size = Math.max(1, parseInt(value, 10) || 1)
    setFamilySize(size)
    setMembers(current => {
      const targetLength = Math.max(0, size - 1)
      if (targetLength === current.length) return current
      if (targetLength < current.length) return current.slice(0, targetLength)
      const extra = Array.from({ length: targetLength - current.length }, () => ({ relationship: 'Other', name: '', birthday: '', notes: '' }))
      return [...current, ...extra]
    })
  }

  const updateMember = (index, field, value) => {
    setMembers(current => current.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  const removeMember = (index) => {
    setMembers(current => current.filter((_, i) => i !== index))
    setFamilySize(current => Math.max(1, current - 1))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!propertyId) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'clientProfiles', propertyId), {
        propertyId,
        familySize,
        ownerBirthday,
        ownerNotes: ownerNotes.trim(),
        members,
      }, { merge: true })

      // Sincroniza los cumpleaños de la familia con el calendario (reemplaza los anteriores de esta casa)
      const existingSnap = await getDocs(query(
        collection(db, 'birthdays'),
        where('propertyId', '==', propertyId),
        where('source', '==', 'clientProfile')
      ))
      await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)))

      const propertyName = property?.name || (isOwnerView ? 'Unnamed house' : 'Casa sin nombre')
      const writes = []
      if (ownerBirthday) {
        writes.push(setDoc(doc(db, 'birthdays', `${propertyId}_owner`), {
          propertyId,
          propertyName,
          name: property?.ownerName || (isOwnerView ? 'Owner' : 'Dueño'),
          date: ownerBirthday,
          note: ownerNotes.trim(),
          source: 'clientProfile',
        }))
      }
      members.forEach((member, idx) => {
        if (!member.birthday) return
        writes.push(setDoc(doc(db, 'birthdays', `${propertyId}_member_${idx}`), {
          propertyId,
          propertyName,
          name: member.name || member.relationship,
          date: member.birthday,
          note: member.notes || '',
          source: 'clientProfile',
        }))
      })
      await Promise.all(writes)

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error al guardar la informaci\u00f3n del cliente:', error)
      alert(isOwnerView ? 'Could not save the information.' : 'No se pudo guardar la información.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{isOwnerView ? 'Get to Know Your Client' : 'Conoce a tu Cliente'}</h2>
          <p className="text-xs text-slate-400">{isOwnerView ? 'Family information and birthdays for your house' : 'Información familiar y cumpleaños por casa'}</p>
        </div>
      </div>

      {!ownerPropertyId && (
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300"><Home className="h-3.5 w-3.5" /> Seleccionar Casa / Propiedad</label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full sm:w-72 rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
          >
            <option value="">Selecciona una casa...</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name || 'Sin nombre'} — Dueño: {p.ownerName || 'Sin dueño'}</option>
            ))}
          </select>
        </div>
      )}

      {propertyId && (
        loading ? (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center text-slate-400 text-xs">{isOwnerView ? 'Loading...' : 'Cargando...'}</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {saved && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">
                <Check className="h-5 w-5" /> {isOwnerView ? 'Information saved successfully!' : '¡Información guardada correctamente!'}
              </div>
            )}

            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white">{property?.name || (isOwnerView ? 'House' : 'Casa')}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">{isOwnerView ? "Owner's Name" : 'Nombre del Dueño'}</label>
                  <div className="w-full rounded-xl border border-slate-700 bg-slate-900/50 p-2.5 text-sm text-slate-300">
                    {property?.ownerName || (isOwnerView ? 'No owner assigned' : 'Sin dueño asignado')}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">{isOwnerView ? 'How many people are in your family?' : '¿Cuántas personas son en su familia?'}</label>
                  <input
                    type="number"
                    min={1}
                    value={familySize}
                    onChange={(e) => handleFamilySizeChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300"><Cake className="h-3.5 w-3.5" /> {isOwnerView ? "Owner's Birthday" : 'Cumpleaños del Dueño'}</label>
                  <input
                    type="date"
                    value={ownerBirthday}
                    onChange={(e) => setOwnerBirthday(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">{isOwnerView ? "Owner's Notes (Optional)" : 'Notas del Dueño (Opcional)'}</label>
                  <input
                    type="text"
                    value={ownerNotes}
                    onChange={(e) => setOwnerNotes(e.target.value)}
                    placeholder={isOwnerView ? 'E.g. Allergies, preferences, etc.' : 'Ej. Alergias, preferencias, etc.'}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {members.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Plus className="h-4 w-4" /> {isOwnerView ? 'Family Members' : 'Integrantes de la Familia'}</h3>
                {members.map((member, idx) => (
                  <div key={idx} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">{isOwnerView ? 'Member' : 'Integrante'} {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeMember(idx)}
                        className="p-1 text-rose-400 hover:bg-slate-700 rounded transition-colors"
                        title={isOwnerView ? 'Remove member' : 'Eliminar integrante'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-300">{isOwnerView ? 'Relationship' : 'Parentesco'}</label>
                        <select
                          value={member.relationship}
                          onChange={(e) => updateMember(idx, 'relationship', e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                        >
                          {RELATIONSHIPS.map(r => <option key={r} value={r}>{isOwnerView ? r : RELATIONSHIP_LABELS_ES[r]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-300">{isOwnerView ? 'Name' : 'Nombre'}</label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateMember(idx, 'name', e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-300">{isOwnerView ? 'Birthday' : 'Cumpleaños'}</label>
                        <input
                          type="date"
                          value={member.birthday}
                          onChange={(e) => updateMember(idx, 'birthday', e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-300">{isOwnerView ? 'Notes' : 'Notas'}</label>
                        <input
                          type="text"
                          value={member.notes}
                          onChange={(e) => updateMember(idx, 'notes', e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 transition-all hover:bg-emerald-400 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? (isOwnerView ? 'Saving...' : 'Guardando...') : (isOwnerView ? 'Save Information' : 'Guardar Información')}
            </button>
          </form>
        )
      )}
    </div>
  )
}
