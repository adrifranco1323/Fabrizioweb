// Firebase Auth exige formato de correo; los usuarios internos escriben solo un nombre de usuario
// y aquí se les agrega un dominio fijo para que Firebase lo acepte como correo.
export const USERNAME_DOMAIN = 'fae.local'

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`
}

export function emailToUsername(email) {
  return (email || '').split('@')[0]
}
