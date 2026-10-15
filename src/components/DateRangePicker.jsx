import { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const TEXT = {
  es: {
    months: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    days: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
    start: 'Inicio',
    end: 'Fin',
    pickStart: 'Toca la fecha de inicio',
    pickEnd: 'Ahora toca la fecha de fin',
    cancel: 'Cancelar',
    sameDay: 'Un solo día'
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    days: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    start: 'Start',
    end: 'End',
    pickStart: 'Tap the start date',
    pickEnd: 'Now tap the end date',
    cancel: 'Cancel',
    sameDay: 'Single day'
  }
}

const pad = (n) => String(n).padStart(2, '0')
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const parseISO = (iso) => {
  const [y, m, d] = (iso || '').split('-').map(Number)
  return y ? { y, m: m - 1, d } : null
}

function formatLabel(iso, months) {
  const p = parseISO(iso)
  if (!p) return '—'
  return `${p.d} ${months[p.m].slice(0, 3)} ${p.y}`
}

export default function DateRangePicker({ startDate, endDate, onChange, locale = 'es', className = '' }) {
  const t = TEXT[locale] || TEXT.es
  const [open, setOpen] = useState(false)
  const [pendingStart, setPendingStart] = useState(null)
  const [hover, setHover] = useState(null)
  const initial = parseISO(startDate) || parseISO(new Date().toISOString().slice(0, 10))
  const [view, setView] = useState({ y: initial.y, m: initial.m })
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const close = () => {
    setOpen(false)
    setPendingStart(null)
    setHover(null)
  }

  const toggle = () => {
    if (open) return close()
    const p = parseISO(startDate)
    if (p) setView({ y: p.y, m: p.m })
    setOpen(true)
  }

  const shiftMonth = (delta) => {
    setView(({ y, m }) => {
      const next = m + delta
      return { y: y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 }
    })
  }

  const pick = (iso) => {
    if (!pendingStart) {
      setPendingStart(iso)
      return
    }
    const [s, e] = iso < pendingStart ? [iso, pendingStart] : [pendingStart, iso]
    onChange(s, e)
    close()
  }

  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  // Rango mostrado: el pendiente (con vista previa al pasar el cursor) o el confirmado
  let rangeStart = startDate
  let rangeEnd = endDate
  if (pendingStart) {
    const other = hover || pendingStart
    rangeStart = other < pendingStart ? other : pendingStart
    rangeEnd = other < pendingStart ? pendingStart : other
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-left text-sm text-white focus:outline-none"
      >
        <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1 truncate">
          <span className="text-slate-400">{t.start}: </span>
          <strong>{formatLabel(startDate, t.months)}</strong>
          <span className="mx-2 text-slate-500">→</span>
          <span className="text-slate-400">{t.end}: </span>
          <strong>{formatLabel(endDate, t.months)}</strong>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 min-w-[18rem] rounded-2xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:right-auto sm:w-80">
          <p className="mb-3 text-center text-xs font-medium text-emerald-400">
            {pendingStart ? t.pickEnd : t.pickStart}
          </p>

          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-white">{t.months[view.m]} {view.y}</span>
            <button type="button" onClick={() => shiftMonth(1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] text-slate-500">
            {t.days.map((d, i) => <div key={i} className="py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />
              const iso = toISO(view.y, view.m, day)
              const isEdge = iso === rangeStart || iso === rangeEnd
              const inRange = iso > rangeStart && iso < rangeEnd
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(iso)}
                  onMouseEnter={() => pendingStart && setHover(iso)}
                  className={`h-10 text-sm transition-colors ${
                    isEdge
                      ? 'rounded-lg bg-emerald-500 font-bold text-slate-950'
                      : inRange
                        ? 'bg-emerald-500/20 text-white'
                        : 'rounded-lg text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            {pendingStart ? (
              <button
                type="button"
                onClick={() => pick(pendingStart)}
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
              >
                {t.sameDay}
              </button>
            ) : <span />}
            <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white">
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
