import { useState } from 'react'
import { signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth'
import { auth, functions } from '../firebase/config'
import { httpsCallable } from 'firebase/functions'
import { usernameToEmail } from '../utils/username'
import { LogIn, Lock, User, KeyRound, Home } from 'lucide-react'

export default function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState('admin')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [ownerCode, setOwnerCode] = useState('')
  const [ownerError, setOwnerError] = useState('')
  const [ownerLoading, setOwnerLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(auth, usernameToEmail(username), password)
      if (onLoginSuccess) onLoginSuccess(userCredential.user)
    } catch (err) {
      console.error(err)
      setError('Usuario o contraseña incorrectos. Verifica tus credenciales.')
    } finally {
      setLoading(false)
    }
  }

  const handleOwnerSubmit = async (e) => {
    e.preventDefault()
    setOwnerError('')
    const normalizedCode = ownerCode.trim().toUpperCase()
    if (!normalizedCode) return

    setOwnerLoading(true)
    try {
      const verifyOwnerCode = httpsCallable(functions, 'ownerSignIn')
      const result = await verifyOwnerCode({ accessCode: normalizedCode })
      const { token, propertyId } = result.data
      localStorage.setItem('ownerPropertyId', propertyId)
      const userCredential = await signInWithCustomToken(auth, token)
      if (onLoginSuccess) onLoginSuccess(userCredential.user)
    } catch (err) {
      console.error(err)
      localStorage.removeItem('ownerPropertyId')
      setOwnerError('No se pudo verificar el código. Intenta de nuevo.')
    } finally {
      setOwnerLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-full max-w-md rounded-2xl bg-slate-800 p-8 shadow-2xl border border-slate-700">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">Gestión de Propiedades</h2>
          <p className="mt-1 text-sm text-slate-400">Ingresa tu cuenta para continuar</p>
        </div>

        <div className="mb-6 flex rounded-xl border border-slate-700 bg-slate-900/50 p-1">
          <button
            type="button"
            onClick={() => setMode('admin')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${mode === 'admin' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
          >
            <Lock className="h-3.5 w-3.5" /> Administrador
          </button>
          <button
            type="button"
            onClick={() => setMode('owner')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${mode === 'owner' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
          >
            <Home className="h-3.5 w-3.5" /> Propietario
          </button>
        </div>

        {mode === 'admin' ? (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Usuario</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="usuario"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/50 py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/50 py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 transition-all hover:bg-emerald-400 disabled:opacity-50"
              >
                <LogIn className="h-5 w-5" />
                {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-4 text-center text-xs text-slate-400">Ingresa el código único de tu propiedad para ver su estado de cuenta.</p>

            {ownerError && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {ownerError}
              </div>
            )}

            <form onSubmit={handleOwnerSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Código de Propiedad</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={ownerCode}
                    onChange={(e) => setOwnerCode(e.target.value.toUpperCase())}
                    placeholder="Ej. AB12CD"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/50 py-2.5 pl-10 pr-4 text-white placeholder-slate-500 font-mono tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={ownerLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 transition-all hover:bg-emerald-400 disabled:opacity-50"
              >
                <LogIn className="h-5 w-5" />
                {ownerLoading ? 'Verificando...' : 'Ver mi Estado de Cuenta'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}