export function normalizeComparable(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-CR')
}

export function getCostaRicaDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type) => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function getCostaRicaMonthStart(value = new Date()) {
  return `${getCostaRicaDate(value).slice(0, 7)}-01`
}