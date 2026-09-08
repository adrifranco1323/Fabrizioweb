import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase/config'
import Login from './pages/Login'
import PropertyForm from './components/PropertyForm'
import ExpenseForm from './components/ExpenseForm'
import Dashboard from './components/Dashboard'
import { Home, Receipt, LayoutDashboard } from 'lucide-react'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard') // Sugerencia: Iniciar en 'dashboard' para ver la vista general de primero

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        Cargando sesión...
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      {/* Encabezado Principal */}
      <div className="mx-auto max-w-4xl mb-6 rounded-xl bg-slate-800 p-4 border border-slate-700 flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-lg font-bold text-emerald-400">Panel de Administración</h1>
          <p className="text-xs text-slate-400">Sesión: {user.email}</p>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Navegación por Pestañas */}
      <div className="mx-auto max-w-4xl mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'dashboard'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard / Mantenimiento
        </button>

        <button
          onClick={() => setActiveTab('properties')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'properties'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Home className="h-4 w-4" /> 1. Agregar Casas
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'expenses'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Receipt className="h-4 w-4" /> 2. Subir Gastos
        </button>
      </div>

      {/* Renderizado Condicional por Pestaña */}
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'properties' && <PropertyForm onPropertyAdded={() => setActiveTab('expenses')} />}
      {activeTab === 'expenses' && <ExpenseForm />}
    </div>
  )
}