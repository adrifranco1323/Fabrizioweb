import { useState, useEffect, useMemo } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, Trash2, Cake, Home, Users as UsersIcon } from 'lucide-react'
import { getCostaRicaDate } from '../utils/formValues'
import DateRangePicker from './DateRangePicker'
import HouseSelectionNotice from './HouseSelectionNotice'

const VISIT_TYPE_COLORS = {
  owner: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  rental: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
}

const BLOCK_EVENT_COLOR = 'bg-rose-500/15 text-rose-200 border-rose-500/40'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Paleta para diferenciar casas en el calendario; cada propertyId siempre cae en el mismo color (hash determinístico)
const PROPERTY_DOT_COLORS = [
  'bg-cyan-400', 'bg-violet-400', 'bg-fuchsia-400', 'bg-orange-400', 'bg-lime-400',
  'bg-sky-400', 'bg-indigo-400', 'bg-teal-400', 'bg-yellow-400', 'bg-purple-400',
  'bg-blue-400', 'bg-pink-400',
]

// Variante sólida y de alto contraste para las tiras/barras de cada visita (texto blanco u oscuro según el tono)
const PROPERTY_BAR_STYLES = [
  { bg: 'bg-cyan-600', text: 'text-white' },
  { bg: 'bg-violet-600', text: 'text-white' },
  { bg: 'bg-fuchsia-600', text: 'text-white' },
  { bg: 'bg-orange-600', text: 'text-white' },
  { bg: 'bg-lime-500', text: 'text-slate-950' },
  { bg: 'bg-sky-600', text: 'text-white' },
  { bg: 'bg-indigo-600', text: 'text-white' },
  { bg: 'bg-teal-600', text: 'text-white' },
  { bg: 'bg-yellow-400', text: 'text-slate-950' },
  { bg: 'bg-purple-600', text: 'text-white' },
  { bg: 'bg-blue-600', text: 'text-white' },
  { bg: 'bg-pink-600', text: 'text-white' },
]

function getPropertyColorIndex(propertyId) {
  if (!propertyId) return -1
  let hash = 0
  for (let i = 0; i < propertyId.length; i++) {
    hash = (hash * 31 + propertyId.charCodeAt(i)) >>> 0
  }
  return hash % PROPERTY_DOT_COLORS.length
}

function getPropertyColor(propertyId) {
  const idx = getPropertyColorIndex(propertyId)
  return idx === -1 ? 'bg-slate-400' : PROPERTY_DOT_COLORS[idx]
}

function getPropertyBarClasses(propertyId) {
  const idx = getPropertyColorIndex(propertyId)
  const style = idx === -1 ? { bg: 'bg-slate-600', text: 'text-white' } : PROPERTY_BAR_STYLES[idx]
  return `${style.bg} ${style.text}`
}

function toISODate(d) {
  return d.toISOString().split('T')[0]
}

function diffDays(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00:00`)
  const b = new Date(`${toISO}T00:00:00`)
  return Math.round((b - a) / 86400000)
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

export default function CalendarView({ role, ownerPropertyId }) {
  const canManage = role === 'admin' || (role === 'owner' && Boolean(ownerPropertyId))
  const isOwnerView = role === 'owner'
  const today = new Date()
  const todayISO = getCostaRicaDate(today)
  const [year, month] = todayISO.split('-').map(Number)
  const visitTypeLabels = {
    owner: isOwnerView ? 'Owner' : 'Dueño',
    rental: isOwnerView ? 'Rental (Airbnb, etc.)' : 'Alquiler (Airbnb, etc.)',
  }
  const eventKindLabels = {
    visit: isOwnerView ? 'Visit' : 'Visita',
    block: isOwnerView ? 'Block' : 'Bloqueo',
  }
  const [cursor, setCursor] = useState(new Date(year, month - 1, 1))
  const [properties, setProperties] = useState([])
  const [visits, setVisits] = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [calendarPropertyId, setCalendarPropertyId] = useState(ownerPropertyId || '')
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(todayISO)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [propertyId, setPropertyId] = useState(ownerPropertyId || '')
  const [eventKind, setEventKind] = useState('visit')
  const [visitType, setVisitType] = useState('owner')
  const [guestName, setGuestName] = useState('')
  const [startDate, setStartDate] = useState(todayISO)
  const [endDate, setEndDate] = useState(todayISO)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showHouseWarning, setShowHouseWarning] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      if (ownerPropertyId) {
        const [propSnap, visitSnap, birthdaySnap] = await Promise.all([
          getDoc(doc(db, 'propertyCalendarDirectory', ownerPropertyId)),
          getDocs(query(collection(db, 'visits'), where('propertyId', '==', ownerPropertyId))),
          getDocs(query(collection(db, 'birthdays'), where('propertyId', '==', ownerPropertyId))),
        ])
        setProperties(propSnap.exists() ? [{ id: propSnap.id, ...propSnap.data() }] : [])
        setVisits(visitSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setBirthdays(birthdaySnap.docs.map(d => ({ id: d.id, ...d.data() })))
        return
      }
      const [propSnap, visitSnap, birthdaySnap] = await Promise.all([
        getDocs(query(collection(db, 'propertyCalendarDirectory'), orderBy('name', 'asc'))),
        getDocs(collection(db, 'visits')),
        getDocs(collection(db, 'birthdays')),
      ])
      setProperties(propSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setVisits(visitSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBirthdays(birthdaySnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error('Error al cargar el calendario:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const monthDays = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const weeks = useMemo(() => {
    const chunks = []
    for (let i = 0; i < monthDays.length; i += 7) chunks.push(monthDays.slice(i, i + 7))
    return chunks
  }, [monthDays])

  // Cumpleaños agrupados por "MM-DD" para comparar sin importar el año
  const birthdaysByMonthDay = useMemo(() => {
    const map = {}
    birthdays.forEach(birthday => {
      if (!birthday.date) return
      const key = birthday.date.slice(5)
      if (!map[key]) map[key] = []
      map[key].push(birthday)
    })
    return map
  }, [birthdays])

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
    setPropertyId(ownerPropertyId || '')
    setEventKind('visit')
    setVisitType('owner')
    setGuestName('')
    setStartDate(selectedDate)
    setEndDate(selectedDate)
    setNotes('')
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setShowHouseWarning(false)
    resetForm()
    setIsModalOpen(true)
  }

  const handleOpenEdit = (v) => {
    setEditingId(v.id)
    setShowHouseWarning(false)
    setPropertyId(v.propertyId || '')
    setEventKind(v.eventKind === 'block' ? 'block' : 'visit')
    setVisitType(v.type || 'owner')
    setGuestName(v.guestName || '')
    setStartDate(v.startDate || selectedDate)
    setEndDate(v.endDate || selectedDate)
    setNotes(v.notes || '')
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!propertyId) {
      setShowHouseWarning(true)
      return
    }
    if (!startDate || !endDate) return
    if (endDate < startDate) {
      alert(isOwnerView ? 'The end date cannot be before the start date.' : 'La fecha final no puede ser anterior a la fecha inicial.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        propertyId,
        eventKind,
        type: eventKind === 'visit' ? visitType : null,
        guestName: eventKind === 'visit' ? guestName.trim() : '',
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
      alert(isOwnerView ? 'Could not save the visit.' : 'No se pudo guardar la visita.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(isOwnerView ? 'Delete this visit?' : '¿Eliminar esta visita?')) return
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
            <h2 className="text-lg font-bold text-white">{isOwnerView ? 'Calendar' : 'Calendario'}</h2>
            <p className="text-xs text-slate-400">{isOwnerView ? 'Visits, property blocks and birthdays for your house' : 'Visitas, bloqueos y cumpleaños por casa'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!ownerPropertyId && (
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
          )}
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
              <Plus className="h-4 w-4" /> {isOwnerView ? 'Add' : 'Agregar'}
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
            <div className="p-10 text-center text-slate-400 text-xs">{isOwnerView ? 'Loading...' : 'Cargando...'}</div>
          ) : (
            <div className="space-y-1">
              {weeks.map((week, weekIdx) => {
                const weekStartIso = toISODate(week[0])
                const weekEndIso = toISODate(week[6])

                const weekVisits = visits.filter(v =>
                  v.startDate && v.endDate && v.startDate <= weekEndIso && v.endDate >= weekStartIso &&
                  (!calendarPropertyId || v.propertyId === calendarPropertyId)
                )

                const bars = weekVisits
                  .map(v => {
                    const clippedStart = v.startDate < weekStartIso ? weekStartIso : v.startDate
                    const clippedEnd = v.endDate > weekEndIso ? weekEndIso : v.endDate
                    return {
                      id: v.id,
                      visit: v,
                      startIdx: diffDays(weekStartIso, clippedStart),
                      endIdx: diffDays(weekStartIso, clippedEnd),
                      isStart: clippedStart === v.startDate,
                      isEnd: clippedEnd === v.endDate,
                    }
                  })
                  .sort((a, b) => (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx) || a.startIdx - b.startIdx)

                const lanesEnd = []
                bars.forEach(bar => {
                  let lane = lanesEnd.findIndex(end => end < bar.startIdx)
                  if (lane === -1) {
                    lane = lanesEnd.length
                    lanesEnd.push(bar.endIdx)
                  } else {
                    lanesEnd[lane] = bar.endIdx
                  }
                  bar.lane = lane
                })

                // Cumpleaños del día: se apilan como tiras de un solo día en las mismas calles
                week.forEach((d, dayIdx) => {
                  const iso = toISODate(d)
                  const monthDay = iso.slice(5)
                  const dayBirthdays = (birthdaysByMonthDay[monthDay] || []).filter(b => !calendarPropertyId || b.propertyId === calendarPropertyId)
                  dayBirthdays.forEach((b, bIdx) => {
                    let lane = lanesEnd.findIndex(end => end < dayIdx)
                    if (lane === -1) {
                      lane = lanesEnd.length
                      lanesEnd.push(dayIdx)
                    } else {
                      lanesEnd[lane] = dayIdx
                    }
                    bars.push({ id: `bday-${weekIdx}-${dayIdx}-${bIdx}`, birthday: b, startIdx: dayIdx, endIdx: dayIdx, isStart: true, isEnd: true, lane })
                  })
                })

                const rowHeight = Math.max(40, 24 + lanesEnd.length * 22 + 6)

                return (
                  <div key={weekIdx} className="relative" style={{ minHeight: `${rowHeight}px` }}>
                    <div className="relative z-10 grid grid-cols-7 gap-1">
                      {week.map((d) => {
                        const iso = toISODate(d)
                        const isCurrentMonth = d.getMonth() === cursor.getMonth()
                        const isSelected = iso === selectedDate
                        return (
                          <button
                            key={iso}
                            onClick={() => setSelectedDate(iso)}
                            style={{ minHeight: `${rowHeight}px` }}
                            className={`relative rounded-xl border text-left transition-all ${
                              isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700/60 bg-slate-900/40 hover:bg-slate-900'
                            } ${isCurrentMonth ? '' : 'opacity-40'}`}
                          >
                            <span className={`absolute left-1 top-1 text-sm font-bold ${iso === todayISO ? 'text-emerald-400' : 'text-slate-200'}`}>{d.getDate()}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 z-0" style={{ top: '22px' }}>
                      {bars.map(bar => {
                        const leftPct = (bar.startIdx / 7) * 100
                        const widthPct = ((bar.endIdx - bar.startIdx + 1) / 7) * 100
                        const top = bar.lane * 22
                        if (bar.birthday) {
                          const b = bar.birthday
                          return (
                            <div
                              key={bar.id}
                              className="pointer-events-auto absolute flex h-4.5 items-center gap-1 overflow-hidden rounded-md bg-pink-600 px-1.5 text-[10px] font-semibold leading-4.5 text-white shadow-sm"
                              style={{ left: `calc(${leftPct}% + 3px)`, width: `calc(${widthPct}% - 6px)`, top: `${top}px` }}
                              title={b.name}
                            >
                              <Cake className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{b.name}</span>
                            </div>
                          )
                        }
                        const v = bar.visit
                        const property = properties.find(p => p.id === v.propertyId)
                        const propertyLabel = property?.name || (isOwnerView ? 'House' : 'Casa')
                        const isBlock = v.eventKind === 'block'
                        const label = isBlock
                          ? `${eventKindLabels.block} · ${propertyLabel}`
                          : `${propertyLabel}${v.guestName ? ` · ${v.guestName}` : ''}`
                        const barClasses = isBlock ? 'bg-rose-700 text-white' : getPropertyBarClasses(v.propertyId)
                        return (
                          <button
                            key={bar.id}
                            type="button"
                            onClick={() => setSelectedDate(toISODate(week[Math.max(bar.startIdx, 0)]))}
                            className={`pointer-events-auto absolute flex h-4.5 items-center gap-1 overflow-hidden text-[10px] font-semibold leading-4.5 shadow-sm ${barClasses} ${bar.isStart ? 'rounded-l-md pl-1.5' : 'pl-1.5'} ${bar.isEnd ? 'rounded-r-md pr-1.5' : 'pr-1.5'}`}
                            style={{ left: `calc(${leftPct}% + 3px)`, width: `calc(${widthPct}% - 6px)`, top: `${top}px` }}
                            title={`${label}${v.notes ? ` · ${v.notes}` : ''} (${v.startDate} ${isOwnerView ? 'to' : 'a'} ${v.endDate})`}
                          >
                            {bar.isStart && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300 ring-1 ring-black/30" />}
                            <span className="flex-1 truncate">{label}</span>
                            {bar.isEnd && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400 ring-1 ring-black/30" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-white">{selectedDate}</h3>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> {isOwnerView ? 'Events' : 'Eventos'}</p>
            {selectedDayEvents.dayVisits.length === 0 ? (
              <p className="text-xs text-slate-500">{isOwnerView ? 'No events scheduled.' : 'Sin eventos programados.'}</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.dayVisits.map(v => {
                  const property = properties.find(p => p.id === v.propertyId)
                  const isBlock = v.eventKind === 'block'
                  const typeLabel = isBlock ? eventKindLabels.block : visitTypeLabels[v.type] || visitTypeLabels.owner
                  const typeColor = isBlock ? BLOCK_EVENT_COLOR : VISIT_TYPE_COLORS[v.type] || VISIT_TYPE_COLORS.owner
                  return (
                    <div key={v.id} className={`rounded-xl border p-2.5 text-xs ${typeColor}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${getPropertyColor(v.propertyId)}`} />
                          {property?.name || (isOwnerView ? 'Deleted house' : 'Casa eliminada')}
                        </span>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleOpenEdit(v)} className="hover:underline">{isOwnerView ? 'Edit' : 'Editar'}</button>
                            <button onClick={() => handleDelete(v.id)} className="p-1 hover:bg-black/10 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                      <p>{typeLabel}{v.guestName ? ` — ${v.guestName}` : ''}</p>
                      <p className="opacity-80">{v.startDate} {isOwnerView ? 'to' : 'a'} {v.endDate}</p>
                      {v.notes && <p className="opacity-80 mt-1">{v.notes}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> {isOwnerView ? 'Birthdays' : 'Cumpleaños'}</p>
            {selectedDayEvents.dayBirthdays.length === 0 ? (
              <p className="text-xs text-slate-500">{isOwnerView ? 'No birthdays this day.' : 'Sin cumpleaños este día.'}</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.dayBirthdays.map((b, idx) => (
                  <div key={idx} className="rounded-xl border border-pink-500/40 bg-pink-500/10 text-pink-200 p-2.5 text-xs">
                    <p className="font-bold">{b.name || (isOwnerView ? 'No name' : 'Sin nombre')} — {b.propertyName}</p>
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
                <UsersIcon className="h-5 w-5 text-emerald-400" /> {editingId ? (isOwnerView ? 'Edit Event' : 'Editar evento') : (isOwnerView ? 'New Event' : 'Nuevo evento')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              {showHouseWarning && <HouseSelectionNotice isEnglish={isOwnerView} />}
              <div>
                <label className="text-slate-300 block mb-1">{isOwnerView ? 'House / Property' : 'Casa / Propiedad'}</label>
                {ownerPropertyId ? (
                  <div className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white">
                    {properties.find(p => p.id === ownerPropertyId)?.name || (isOwnerView ? 'Your house' : 'Tu casa')}
                  </div>
                ) : (
                  <select
                    value={propertyId}
                    onChange={e => {
                      setPropertyId(e.target.value)
                      setShowHouseWarning(false)
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                  >
                    <option value="">Selecciona una casa...</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="text-slate-300 block mb-1">{isOwnerView ? 'Event Type' : 'Tipo de evento'}</label>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                  {['visit', 'block'].map(kind => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={eventKind === kind}
                      onClick={() => {
                        setEventKind(kind)
                        if (kind === 'block') setGuestName('')
                      }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${eventKind === kind ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      {eventKindLabels[kind]}
                    </button>
                  ))}
                </div>
              </div>

              {eventKind === 'visit' && (
                <div>
                  <label className="text-slate-300 block mb-1">{isOwnerView ? 'Visit Category' : 'Tipo de visita'}</label>
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                    {Object.keys(VISIT_TYPE_COLORS).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setVisitType(key)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${visitType === key ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      >
                        {visitTypeLabels[key]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {eventKind === 'visit' && visitType === 'rental' && (
                <div>
                  <label className="text-slate-300 block mb-1">{isOwnerView ? 'Guest Name (Optional)' : 'Nombre del Inquilino (Opcional)'}</label>
                  <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
                </div>
              )}

              <div>
                <label className="text-slate-300 block mb-1">{isOwnerView ? 'Dates' : 'Fechas'}</label>
                <DateRangePicker
                  locale={isOwnerView ? 'en' : 'es'}
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(s, e) => { setStartDate(s); setEndDate(e) }}
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">
                  {isOwnerView
                    ? (eventKind === 'block' ? 'Reason / Notes (Optional)' : 'Notes (Optional)')
                    : (eventKind === 'block' ? 'Motivo / Notas (Opcional)' : 'Notas (Opcional)')}
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white" />
              </div>

              <button
                type="submit"
                onClick={(e) => {
                  if (!propertyId) {
                    e.preventDefault()
                    setShowHouseWarning(true)
                  }
                }}
                disabled={saving}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 rounded-xl text-sm mt-2 disabled:opacity-50"
              >
                {saving ? (isOwnerView ? 'Saving...' : 'Guardando...') : (isOwnerView ? 'Save Visit' : 'Guardar Visita')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
