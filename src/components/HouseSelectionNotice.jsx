import { AlertTriangle, Home } from 'lucide-react'

export default function HouseSelectionNotice({ isEnglish = false }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 shadow-lg shadow-amber-950/10"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
          <Home className="h-3.5 w-3.5 shrink-0" />
          {isEnglish ? 'Select a house to continue' : 'Selecciona una casa para continuar'}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
          {isEnglish
            ? 'Choose the property you want to use before saving.'
            : 'Elige la propiedad que deseas usar antes de guardar.'}
        </p>
      </div>
    </div>
  )
}
