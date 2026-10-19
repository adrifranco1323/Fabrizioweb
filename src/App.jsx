import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase/config'
import { emailToUsername } from './utils/username'
import Login from './pages/Login'
import PropertiesList from './components/PropertiesList'
import ContractsInfo from './components/ContractsInfo'
import ExpenseForm from './components/ExpenseForm'
import Statements from './components/Statements'
import ProvidersList from './components/ProvidersList'
import ClientsList from './components/ClientsList'
import UsersList from './components/UsersList'
import CalendarView from './components/CalendarView'
import OwnerApp from './components/OwnerApp'
import ClientProfile from './components/ClientProfile'
import SharedAccounts from './components/SharedAccounts'
import { Home, Receipt, PieChart, Users, FileText, Contact, Menu, X, LogOut, UserCog, CalendarDays, Layers } from 'lucide-react'

const NAV_ITEMS = [
  { key: 'statements', label: 'Estados de Cuenta', icon: PieChart, roles: ['admin', 'assistant'] },
  { key: 'expenses', label: 'Movimientos', icon: Receipt, roles: ['admin', 'assistant'] },
  { key: 'properties', label: 'Casas', icon: Home, roles: ['admin'] },
  { key: 'clients', label: 'Clientes y Carros', icon: Contact, roles: ['admin'] },
  { key: 'sharedAccounts', label: 'Cuentas compartidas', icon: Layers, roles: ['admin'] },
  { key: 'contracts', label: 'Contratos y Servicios', icon: FileText, roles: ['admin'] },
  { key: 'providers', label: 'Proveedores', icon: Users, roles: ['admin', 'assistant'] },
  { key: 'calendar', label: 'Calendario', icon: CalendarDays, roles: ['admin', 'assistant', 'maid'] },
  { key: 'clientProfile', label: 'Conoce a tu Cliente', icon: Users, roles: ['admin', 'assistant'] },
  { key: 'users', label: 'Usuarios', icon: UserCog, roles: ['admin'] },
]

const INITIAL_ADMIN_UID = 'Z1bcROoshfhExCgPhD1FWS8zDDp1'

export default function App() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('statements')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Una sesión anónima sin propiedad asociada es inválida (código no verificado)
      if (currentUser?.isAnonymous && !localStorage.getItem('ownerPropertyId') && !localStorage.getItem('ownerAccountId')) {
        await signOut(auth)
        setUser(null)
        setRole(null)
        setLoading(false)
        return
      }

      if (currentUser && !currentUser.isAnonymous) {
        const offlineAdminKey = `offline-admin:${currentUser.uid}`
        const hasCachedAdminRole = localStorage.getItem(offlineAdminKey) === 'admin'
        if (!navigator.onLine && hasCachedAdminRole) {
          setRole('admin')
          setActiveTab('contracts')
        } else {
          try {
            const tokenResult = await currentUser.getIdTokenResult()
            if (tokenResult.claims.role === 'owner') {
              setRole('owner')
            } else {
              const roleSnap = await getDoc(doc(db, 'users', currentUser.uid))
              if (currentUser.uid === INITIAL_ADMIN_UID) {
                if (!roleSnap.exists() || roleSnap.data().role !== 'admin' || !roleSnap.data().username) {
                  await setDoc(doc(db, 'users', currentUser.uid), {
                    username: emailToUsername(currentUser.email),
                    role: 'admin',
                  }, { merge: true })
                }
                setRole('admin')
                localStorage.setItem(offlineAdminKey, 'admin')
              } else if (roleSnap.exists()) {
                const resolvedRole = roleSnap.data().role || null
                setRole(resolvedRole)
                if (resolvedRole === 'admin') localStorage.setItem(offlineAdminKey, 'admin')
              } else {
                setRole(null)
              }
            }
          } catch (err) {
            console.error('Error al cargar el rol del usuario:', err)
            const networkUnavailable = !navigator.onLine || ['auth/network-request-failed', 'unavailable'].includes(err?.code)
            setRole(networkUnavailable && hasCachedAdminRole ? 'admin' : null)
            if (networkUnavailable && hasCachedAdminRole) setActiveTab('contracts')
          }
        }
      } else {
        setRole(null)
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

  useEffect(() => {
    const scrollKey = 'fae-app-scroll-y'
    const restoreTimers = []
    let scrollFrame = null
    let restoringUntil = 0
    let lastInteractionAt = 0
    let lastKnownY = window.scrollY

    try {
      lastKnownY = Math.max(lastKnownY, Number(sessionStorage.getItem(scrollKey) || 0))
    } catch {
      // The in-memory position remains available if session storage is disabled.
    }

    const getScrollY = () => window.scrollY || document.scrollingElement?.scrollTop || 0
    const savePosition = (y) => {
      lastKnownY = y
      try {
        sessionStorage.setItem(scrollKey, String(y))
      } catch {
        // Scroll restoration still works for the current tab without storage.
      }
    }

    const saveScroll = () => {
      if (scrollFrame !== null || Date.now() < restoringUntil) return
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null
        const currentY = getScrollY()
        const automaticJump = currentY < 100 && lastKnownY > 200 && Date.now() - lastInteractionAt > 1800
        if (automaticJump) {
          restoreScroll(lastKnownY)
        } else {
          savePosition(currentY)
        }
      })
    }

    const restoreScroll = (targetY = lastKnownY) => {
      if (!Number.isFinite(targetY) || targetY <= 0) return
      restoreTimers.splice(0).forEach(clearTimeout)
      restoringUntil = Date.now() + 2500
      ;[0, 100, 300, 700, 1200, 2000].forEach(delay => {
        restoreTimers.push(setTimeout(() => {
          if (document.hidden) return
          window.scrollTo(0, targetY)
          if (document.scrollingElement) document.scrollingElement.scrollTop = targetY
        }, delay))
      })
    }

    const blurActiveField = () => {
      const el = document.activeElement
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) el.blur()
    }

    const onLeave = () => {
      const currentY = getScrollY()
      const automaticJump = currentY < 100 && lastKnownY > 200 && Date.now() - lastInteractionAt > 1800
      if (!automaticJump) savePosition(currentY)
      restoringUntil = Date.now() + 2500
      blurActiveField()
      if (!document.hidden) {
        const stableY = lastKnownY
        restoreTimers.push(setTimeout(() => restoreScroll(stableY), 50))
      }
    }

    const onResume = () => {
      blurActiveField()
      restoreScroll()
    }
    const onViewportResize = () => {
      const currentY = getScrollY()
      if (lastKnownY - currentY > 120 && Date.now() - lastInteractionAt > 1800) {
        blurActiveField()
        restoreScroll()
      }
    }
    const onUserInteraction = () => { lastInteractionAt = Date.now() }
    const onVisibility = () => (document.hidden ? onLeave() : onResume())
    window.addEventListener('scroll', saveScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('blur', onLeave)
    window.addEventListener('focus', onResume)
    window.addEventListener('resize', onViewportResize)
    window.visualViewport?.addEventListener('resize', onViewportResize)
    document.addEventListener('touchstart', onUserInteraction, { passive: true })
    document.addEventListener('wheel', onUserInteraction, { passive: true })
    document.addEventListener('pointerdown', onUserInteraction, { passive: true })
    document.addEventListener('keydown', onUserInteraction)
    restoreScroll(lastKnownY)
    return () => {
      window.removeEventListener('scroll', saveScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('blur', onLeave)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('resize', onViewportResize)
      window.visualViewport?.removeEventListener('resize', onViewportResize)
      document.removeEventListener('touchstart', onUserInteraction)
      document.removeEventListener('wheel', onUserInteraction)
      document.removeEventListener('pointerdown', onUserInteraction)
      document.removeEventListener('keydown', onUserInteraction)
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
      restoreTimers.forEach(clearTimeout)
    }
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

  if (user.isAnonymous || role === 'owner') {
    const ownerPropertyId = localStorage.getItem('ownerPropertyId')
    const ownerAccountId = localStorage.getItem('ownerAccountId')
    return (
      <OwnerApp
        propertyId={ownerPropertyId}
        accountId={ownerAccountId}
        onLogout={() => {
          localStorage.removeItem('ownerPropertyId')
          localStorage.removeItem('ownerAccountId')
          signOut(auth)
        }}
      />
    )
  }

  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 p-4 text-center text-white">
        <p className="text-lg font-bold">Tu cuenta no tiene un rol asignado.</p>
        <p className="max-w-sm text-sm text-slate-400">Pide a un administrador que te asigne un rol desde el tab de Usuarios para poder continuar.</p>
        <button
          onClick={() => signOut(auth)}
          className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20"
        >
          <LogOut className="h-4 w-4" /> Cerrar Sesión
        </button>
      </div>
    )
  }

  const handleSelectTab = (key) => {
    setActiveTab(key)
    setIsSidebarOpen(false)
  }

  const visibleNavItems = NAV_ITEMS.filter(item => item.roles.includes(role))
  // Si el rol no tiene acceso al tab activo (p. ej. tras cambiar de rol), cae al primero disponible
  const safeActiveTab = visibleNavItems.some(item => item.key === activeTab)
    ? activeTab
    : (visibleNavItems[0]?.key || 'calendar')

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
        <span className="w-9" aria-hidden="true" />
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
            <p className="truncate text-xs text-slate-400">Sesión: {emailToUsername(user.email)}</p>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          {visibleNavItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleSelectTab(key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all ${
                safeActiveTab === key ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-900/40 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

      </aside>

      {/* Contenido principal */}
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto mb-4 flex max-w-5xl justify-end">
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20"
          >
            <LogOut className="h-4 w-4" /> Cerrar Sesión
          </button>
        </div>
        <div className="mx-auto max-w-5xl">
          {safeActiveTab === 'statements' && <Statements role={role} />}
          {safeActiveTab === 'expenses' && <ExpenseForm role={role} />}
          {safeActiveTab === 'properties' && <PropertiesList />}
          {safeActiveTab === 'clients' && <ClientsList />}
          {safeActiveTab === 'sharedAccounts' && <SharedAccounts />}
          {safeActiveTab === 'contracts' && <ContractsInfo />}
          {safeActiveTab === 'providers' && <ProvidersList role={role} />}
          {safeActiveTab === 'calendar' && <CalendarView role={role} />}
          {safeActiveTab === 'clientProfile' && <ClientProfile role={role} />}
          {safeActiveTab === 'users' && <UsersList />}
        </div>
      </main>
    </div>
  )
}