import { useState, useEffect } from 'react'
import { db, secondaryAuth, functions } from '../firebase/config'
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { usernameToEmail } from '../utils/username'
import { UserCog, Plus, Edit2, Trash2, X, ShieldCheck, KeyRound } from 'lucide-react'

export const ROLE_LABELS = {
  admin: 'Administrador',
  assistant: 'Asistente',
  maid: 'Maid',
}

export const ROLE_DESCRIPTIONS = {
  admin: 'Acceso total a todos los módulos',
  assistant: 'Estados de cuenta, movimientos, proveedores y calendario',
  maid: 'Solo el módulo de Calendario',
}

export default function UsersList() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('assistant')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [passwordTarget, setPasswordTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'users'), orderBy('username', 'asc'))
      const snap = await getDocs(q)
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('Error al cargar usuarios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleOpenCreate = () => {
    setEditingId(null)
    setEmail('')
    setPassword('')
    setRole('assistant')
    setError('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (u) => {
    setEditingId(u.id)
    setEmail(u.username || '')
    setPassword('')
    setRole(u.role || 'assistant')
    setError('')
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (editingId) {
        // Solo se actualiza el rol; el usuario/contraseña se gestionan desde Firebase Auth
        await updateDoc(doc(db, 'users', editingId), { role })
      } else {
        const normalizedUsername = email.trim().toLowerCase().replace(/\s+/g, '')
        if (!normalizedUsername) {
          setError('El usuario es obligatorio.')
          setSaving(false)
          return
        }
        if (!password || password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres.')
          setSaving(false)
          return
        }
        // Se crea en una instancia secundaria para no cerrar la sesión del administrador actual
        const credential = await createUserWithEmailAndPassword(secondaryAuth, usernameToEmail(normalizedUsername), password)
        await setDoc(doc(db, 'users', credential.user.uid), {
          username: normalizedUsername,
          role,
        })
        await signOut(secondaryAuth)
      }
      setIsModalOpen(false)
      fetchUsers()
    } catch (err) {
      console.error('Error al guardar usuario:', err)
      if (err.code === 'auth/email-already-in-use') {
        setError('Ese usuario ya está registrado.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Nombre de usuario inválido (usa solo letras, números, puntos o guiones).')
      } else {
        setError('No se pudo guardar el usuario.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u) => {
    if (!confirm(`¿Eliminar el acceso de ${u.username}? Esto quita sus permisos, pero la cuenta debe deshabilitarse también desde la consola de Firebase Authentication.`)) return
    try {
      await deleteDoc(doc(db, 'users', u.id))
      fetchUsers()
    } catch (err) {
      console.error('Error al eliminar usuario:', err)
    }
  }

  const handleOpenPassword = (u) => {
    setPasswordTarget(u)
    setNewPassword('')
    setPasswordError('')
    setPasswordSuccess(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setPasswordSaving(true)
    try {
      const setUserPassword = httpsCallable(functions, 'adminSetUserPassword')
      await setUserPassword({ targetUid: passwordTarget.id, newPassword })
      setPasswordSuccess(true)
      setNewPassword('')
    } catch (err) {
      console.error('Error al cambiar la contraseña:', err)
      setPasswordError(err.message || 'No se pudo cambiar la contraseña.')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-white">Usuarios y Roles</h2>
          <p className="text-xs text-slate-400">Administra quién puede ingresar y qué puede ver cada rol</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        >
          <Plus className="h-4 w-4" /> Agregar Usuario
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-xs border-b border-slate-700">
                <th className="p-3">Usuario</th>
                <th className="p-3">Rol</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 text-sm">
              {loading ? (
                <tr><td colSpan={3} className="p-4 text-center text-slate-400 text-xs">Cargando...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={3} className="p-4 text-center text-slate-400 text-xs">No hay usuarios registrados.</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-slate-750">
                  <td className="p-3 text-white">{u.username}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-xs font-semibold text-cyan-400">
                      <ShieldCheck className="h-3.5 w-3.5" /> {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <button onClick={() => handleOpenPassword(u)} className="p-1 text-cyan-400 hover:bg-slate-700 rounded" title="Cambiar contraseña" aria-label={`Cambiar contraseña de ${u.username}`}><KeyRound className="h-4 w-4" /></button>
                    <button onClick={() => handleOpenEdit(u)} className="p-1 text-amber-400 hover:bg-slate-700 rounded"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(u)} className="p-1 text-red-400 hover:bg-slate-700 rounded"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <UserCog className="h-5 w-5 text-emerald-400" /> {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">{error}</div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Usuario</label>
                <input
                  type="text"
                  required
                  disabled={!!editingId}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white disabled:opacity-60"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="text-slate-300 block mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-300 block mb-1">Rol</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                >
                  {Object.keys(ROLE_LABELS).map(key => (
                    <option key={key} value={key}>{ROLE_LABELS[key]}</option>
                  ))}
                </select>
                <p className="text-slate-500 mt-1">{ROLE_DESCRIPTIONS[role]}</p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 rounded-xl text-sm mt-2 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Usuario'}
              </button>
            </form>
          </div>
        </div>
      )}

      {passwordTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-white">
                <KeyRound className="h-5 w-5 text-cyan-400" /> Cambiar contraseña de {passwordTarget.username}
              </h3>
              <button onClick={() => setPasswordTarget(null)} className="text-slate-400 hover:text-white" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">Firebase no permite consultar la contraseña actual. Puedes establecer una nueva.</p>
            {passwordError && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">{passwordError}</div>}
            {passwordSuccess && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">Contraseña actualizada correctamente.</div>}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Nueva contraseña</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white"
                />
              </div>
              <button type="submit" disabled={passwordSaving} className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
                {passwordSaving ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
