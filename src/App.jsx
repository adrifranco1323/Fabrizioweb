import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase/config'
import Login from './pages/Login'
import PropertiesList from './components/PropertiesList'
import ContractsInfo from './components/ContractsInfo'
import ExpenseForm from './components/ExpenseForm'
import Statements from './components/Statements'
import ProvidersList from './components/ProvidersList'
import ClientsList from './components/ClientsList'
import OwnerStatementView from './components/OwnerStatementView'
import { Home, Receipt, PieChart, Users, FileText, Contact, Menu, X, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { key: 'statements', label: 'Estados de Cuenta', icon: PieChart },
  { key: 'expenses', label: 'Movimientos', icon: Receipt },
  { key: 'properties', label: 'Casas', icon: Home },
  { key: 'clients', label: 'Clientes y Carros', icon: Contact },
  { key: 'contracts', label: 'Contratos y Servicios', icon: FileText },
  { key: 'providers', label: 'Proveedores', icon: Users },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('statements')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Una sesión anónima sin propiedad asociada es inválida (código no verificado)
      if (currentUser?.isAnonymous && !localStorage.getItem('ownerPropertyId')) {
        await signOut(auth)
        setUser(null)
        setLoading(false)
        return
      }
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    // Evita que el scroll cambie el valor de un input numérico enfocado
    const blurNumberInputOnWheel = (e) => {
      if (document.activeElement?.type === 'number') {
        document.activeElement.blur()
      }
    }
    document.addEventListener('wheel', blurNumberInputOnWheel, { passive: true })
    return () => document.removeEventListener('wheel', blurNumberInputOnWheel)
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

  if (user.isAnonymous) {
    const ownerPropertyId = localStorage.getItem('ownerPropertyId')
    return (
      <OwnerStatementView
        propertyId={ownerPropertyId}
        onLogout={() => {
          localStorage.removeItem('ownerPropertyId')
          signOut(auth)
        }}
      />
    )
  }

  const handleSelectTab = (key) => {
    setActiveTab(key)
    setIsSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white md:flex">
      {/* Barra superior (solo móvil) */}
      <div className="flex items-center justify-between bg-slate-800 border-b border-slate-700 p-4 md:hidden">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-bold text-emerald-400">Panel de Administración</h1>
        <button
          onClick={() => signOut(auth)}
          className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Overlay para cerrar el panel en móvil */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      {/* Panel lateral de navegación */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-4 border-r border-slate-700 bg-slate-800 p-4 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-emerald-400">Panel de Administración</h1>
            <p className="truncate text-xs text-slate-400">Sesión: {user.email}</p>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleSelectTab(key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all ${
                activeTab === key ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-900/40 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        <button
          onClick={() => signOut(auth)}
          className="mt-auto hidden items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 md:flex"
        >
          <LogOut className="h-4 w-4" /> Cerrar Sesión
        </button>
      </aside>

      {/* Contenido principal */}
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          {activeTab === 'statements' && <Statements />}
          {activeTab === 'expenses' && <ExpenseForm />}
          {activeTab === 'properties' && <PropertiesList />}
          {activeTab === 'clients' && <ClientsList />}
          {activeTab === 'contracts' && <ContractsInfo />}
          {activeTab === 'providers' && <ProvidersList />}
        </div>
      </main>
    </div>
  )
}