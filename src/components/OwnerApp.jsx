import { useState } from 'react'
import OwnerStatementView from './OwnerStatementView'
import CalendarView from './CalendarView'
import ClientProfile from './ClientProfile'
import { PieChart, CalendarDays, Users, LogOut } from 'lucide-react'

const TABS = [
  { key: 'statement', label: 'Account Statement', icon: PieChart },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'clientProfile', label: 'Get to Know Your Client', icon: Users },
]

export default function OwnerApp({ propertyId, onLogout }) {
  const [activeTab, setActiveTab] = useState('statement')

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-800/60 p-3">
        <nav className="flex flex-wrap gap-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === key ? 'bg-emerald-500 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20"
        >
          <LogOut className="h-4 w-4" /> Log Out
        </button>
      </div>

      {activeTab === 'statement' && <OwnerStatementView propertyId={propertyId} onLogout={onLogout} hideLogout />}
      {activeTab === 'calendar' && <div className="p-4 md:p-8"><CalendarView role="owner" ownerPropertyId={propertyId} /></div>}
      {activeTab === 'clientProfile' && <div className="p-4 md:p-8"><ClientProfile role="owner" ownerPropertyId={propertyId} /></div>}
    </div>
  )
}
