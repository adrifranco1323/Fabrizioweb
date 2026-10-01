import { useState, useEffect, useMemo, useRef } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, Trash2, Cake, Home, Users as UsersIcon } from 'lucide-react'

const VISIT_TYPES = {
  owner: { label: 'Dueño', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  rental: { label: 'Alquiler (Airbnb, etc.)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toISODate(d) {
  return d.toISOString().split('T')[0]
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const gridStart = new Date(year, month, 1 - startOffset)
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

export default function CalendarView({ role }) {
  const canManage = role === 'admin'
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [properties, setProperties] = useState([])
  const [visits, setVisits] = useState([])
  const [calendarPropertyId, setCalendarPropertyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(toISODate(today))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [propertyId, setPropertyId] = useState('')
  const [visitType, setVisitType] = useState('owner')
  const [guestName, setGuestName] = useState('')
  const [startDate, setStartDate] = useState(toISODate(today))
  const [endDate, setEndDate] = useState(toISODate(today))
  const endDateInputRef = useRef(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const propSnap = await getDocs(query(collection(db, 'properties'), orderBy('name', 'asc')))
      setProperties(propSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      const visitSnap = await getDocs(collection(db, 'visits'))
      setVisits(visitSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error('Error al cargar el calendario:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const monthDays = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])

  // Cumpleaños agrupados por "MM-DD" para comparar sin importar el año
  const birthdaysByMonthDay = useMemo(() => {
    const map = {}
    properties.forEach(p => {
      (p.birthdays || []).forEach(b => {
        if (!b.date) return
        const key = b.date.slice(5) // "MM-DD"
        if (!map[key]) map[key] = []
        map[key].push({ ...b, propertyId: p.id, propertyName: p.name })
      })
    })
    return map
  }, [properties])

  const getEventsForDay = (dateObj) => {
    const iso = toISODate(dateObj)
    const monthDay = iso.slice(5)
    const dayVisits = visits.filter(v =>
      v.startDate && v.endDate && iso >= v.startDate && iso <= v.endDate &&
      (!calendarPropertyId || v.propertyId === calendarPropertyId)
    )
    const dayBirthdays = (birthdaysByMonthDay[monthDay] || []).filter(b =>
      !calendarPropertyId || b.propertyId === calendarPropertyId
    )
    return { dayVisits, dayBirthdays }
  }

  const resetForm = () => {
    setPropertyId('')
    setVisitType('owner')
    setGuestName('')
    setStartDate(selectedDate)
    setEndDate(selectedDate)
    setNotes('')
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    resetForm()
    setIsModalOpen(true)
  }

  const handleOpenEdit = (v) => {
    setEditingId(v.id)
    setPropertyId(v.propertyId || '')
    setVisitType(v.type || 'owner')
    setGuestName(v.guestName || '')
    setStartDate(v.startDate || selectedDate)
    setEndDate(v.endDate || selectedDate)
    setNotes(v.notes || '')
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!propertyId || !startDate || !endDate) return
    if (endDate < startDate) {
      alert('La fecha final no puede ser anterior a la fecha inicial.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        propertyId,
        type: visitType,
        guestName: guestName.trim(),
        startDate,
        endDate,
        notes: notes.trim(),
      }
      if (editingId) {
        await updateDoc(doc(db, 'visits', editingId), payload)
      } else {
        await addDoc(collection(db, 'visits'), payload)
      }
      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error al guardar la visita:', error)
      alert('No se pudo guardar la visita.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta visita?')) return
    try {
      await deleteDoc(doc(db, 'visits', id))
      fetchData()
    } catch (error) {
      console.error('Error al eliminar la visita:', error)
    }
  }

  const selectedDayEvents = getEventsForDay(new Date(`${selectedDate}T00:00:00`))
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Calendario</h2>
            <p className="text-xs text-slate-400">Visitas de dueños/inquilinos y cumpleaños por casa</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <select
            value={calendarPropertyId}
            onChange={e => setCalendarPropertyId(e.target.value)}
            aria-label="Filtrar calendario por casa"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white focus:outline-none sm:w-52"
          >
            <option value="">Todas las casas</option>
            {properties.map(property => (
              <option key={property.id} value={property.id}>{property.name || 'Casa sin nombre'}</option>
            ))}
          </select>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-white capitalize w-36 text-center">{monthLabel}</span>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
          {canManage && (
            <button
              onClick={handleOpenCreate}
              className="ml-2 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            >
              <Plus className="h-4 w-4" /> Agregar Visita
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-3">
          <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {WEEKDAYS.map(w => <div key={w} className="py-1">{w}</div>)}
          </div>
          {loading ? (
            <div className="p-10 text-center text-slate-400 text-xs">Cargando...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((d) => {
                const iso = toISODate(d)
                const isCurrentMonth = d.getMonth() === cursor.getMonth()
                const isSelected = iso === selectedDate
                const { dayVisits, dayBirthdays } = getEventsForDay(d)
                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    className={`min-h-20 rounded-xl border p-1.5 text-left transition-all ${
                      isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700/60 bg-slate-900/40 hover:bg-slate-900'
                    } ${isCurrentMonth ? '' : 'opacity-40'}`}
                  >
                    <span className={`text-xs font-semibold ${iso === toISODate(today) ? 'text-emerald-400' : 'text-slate-300'}`}>{d.getDate()}</span>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {dayVisits.slice(0, 2).map(v => (
                        <span key={v.id} className={`h-1.5 w-1.5 rounded-full ${v.type === 'owner' ? 'bg-cyan-400' : 'bg-amber-400'}`} />
                      ))}
                      {dayBirthdays.slice(0, 2).map((b, idx) => (
                        <Cake key={idx} className="h-2.5 w-2.5 text-pink-400" />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-white">{selectedDate}</h3>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> Visitas</p>
            {selectedDayEvents.dayVisits.length === 0 ? (
              <p className="text-xs text-slate-500">Sin visitas programadas.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.dayVisits.map(v => {
                  const property = properties.find(p => p.id === v.propertyId)
                  const typeInfo = VISIT_TYPES[v.type] || VISIT_TYPES.owner
                  return (
                    <div key={v.id} className={`rounded-xl border p-2.5 text-xs ${typeInfo.color}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{property?.name || 'Casa eliminada'}</span>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleOpenEdit(v)} className="hover:underline">Editar</button>
                            <button onClick={() => handleDelete(v.id)} className="p-1 hover:bg-black/10 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                      <p>{typeInfo.label}{v.guestName ? ` — ${v.guestName}` : ''}</p>
                      <p className="opacity-80">{v.startDate} a {v.endDate}</p>
                      {v.notes && <p className="opacity-80 mt-1">{v.notes}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> Cumpleaños</p>
            {selectedDayEvents.dayBirthdays.length === 0 ? (
              <p className="text-xs text-slate-500">Sin cumpleaños este día.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.dayBirthdays.map((b, idx) => (
                  <div key={idx} className="rounded-xl border border-pink-500/40 bg-pink-500/10 text-pink-200 p-2.5 text-xs">
                    <p className="font-bold">{b.name || 'Sin nombre'} — {b.propertyName}</p>
                    {b.note && <p className="opacity-80 mt-1">{b.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && canManage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-emerald-400" /> {editingId ? 'Editar Visita' : 'Nueva Visita'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Casa / Propiedad</label>
                <select required value={propertyId} onChange={e => setPropertyId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none">
                  <option value="">Selecciona una casa...</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Tipo de Visita</label>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                  {Object.entries(VISIT_TYPES).map(([key, info]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setVisitType(key)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${visitType === key ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>

              {visitType === 'rental' && (
                <div>
                  <label className="text-slate-300 block mb-1">Nombre del Inquilino (Opcional)</label>
                  <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => {
                      const nextStartDate = e.target.value
                      setStartDate(nextStartDate)
                      if (endDate < nextStartDate) setEndDate(nextStartDate)
                      try {
                        endDateInputRef.current?.showPicker()
                      } catch {
                        endDateInputRef.current?.focus()
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Fecha Fin</label>
                  <input ref={endDateInputRef} type="date" required min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Notas (Opcional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
              </div>

              <button type="submit" disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 rounded-xl text-sm mt-2 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar Visita'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
