// Cuentas compartidas: agrupan casas que comparten ingresos. Los gastos y los ingresos
// de cada casa se leen de sus colecciones; aquí solo se agrupan y se calculan totales.

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O/1/I para evitar confusiones

export function generateAccessCode() {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

// Devuelve la cuenta que ya usa alguna de las casas, o null
export function findPropertyConflict(accounts, propertyIds, ignoreAccountId = null) {
  for (const account of accounts) {
    if (account.id === ignoreAccountId) continue
    const overlap = (account.propertyIds || []).find(id => propertyIds.includes(id))
    if (overlap) return { propertyId: overlap, accountName: account.name }
  }
  return null
}

// Valida y normaliza los datos de una cuenta; lanza Error con un mensaje legible si no son válidos
export function validateAccount(accounts, { id, name, propertyIds, accessCode }, takenCodes = []) {
  const cleanName = (name || '').trim()
  const uniqueIds = [...new Set(propertyIds || [])]
  const code = (accessCode || '').trim().toUpperCase()
  if (!cleanName) throw new Error('La cuenta necesita un nombre.')
  if (uniqueIds.length < 2) throw new Error('Selecciona al menos 2 casas para una cuenta compartida.')
  const conflict = findPropertyConflict(accounts, uniqueIds, id)
  if (conflict) throw new Error(`Una de las casas ya pertenece a la cuenta "${conflict.accountName}".`)
  if (!code) throw new Error('El código de acceso es obligatorio.')
  if (takenCodes.some(taken => (taken || '').toUpperCase() === code)) {
    throw new Error('Ese código de acceso ya está en uso. Genera uno nuevo.')
  }
  return { name: cleanName, propertyIds: uniqueIds, accessCode: code }
}

export function buildIncome({ accountId, description, date, currency, originalAmount, exchangeRate }) {
  const amount = Number(originalAmount)
  const rate = Number(exchangeRate) || 440
  if (!accountId) throw new Error('La cuenta no existe.')
  if (!(amount > 0)) throw new Error('El monto debe ser mayor a 0.')
  if (!date) throw new Error('La fecha es obligatoria.')
  return {
    accountId,
    description: (description || '').trim() || 'Ingreso compartido',
    date,
    currency,
    originalAmount: amount,
    exchangeRate: rate,
    amountCRC: currency === 'CRC' ? amount : amount * rate,
    amountUSD: currency === 'USD' ? amount : amount / rate,
  }
}

const sumUSD = items => items.reduce((total, item) => total + (Number(item.amountUSD) || 0), 0)

// Estado de la cuenta: ingresos de la cuenta + ingresos de sus casas + gastos de sus casas.
// Cada ingreso trae `accountId` (de la cuenta) o `propertyId` (de una casa).
// Los movimientos sin fecha se incluyen en el periodo, igual que en el estado de cuenta actual.
export function computeAccountStatement({ account, incomes, houseIncomes = [], expenses, startDate, endDate }) {
  const propertyIds = new Set(account.propertyIds)
  const accountIncomes = [
    ...incomes.filter(i => i.accountId === account.id),
    ...houseIncomes.filter(i => propertyIds.has(i.propertyId)),
  ]
  const accountExpenses = expenses.filter(e => propertyIds.has(e.propertyId))

  const inPeriod = item => !item.date || (item.date >= startDate && item.date <= endDate)
  const before = item => Boolean(item.date) && item.date < startDate

  const periodIncomes = accountIncomes.filter(inPeriod).sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const periodExpenses = accountExpenses.filter(inPeriod)

  const expensesByProperty = account.propertyIds.map(propertyId => {
    const items = periodExpenses
      .filter(e => e.propertyId === propertyId)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    return { propertyId, items, totalUSD: sumUSD(items) }
  })

  const totalIncomeUSD = sumUSD(periodIncomes)
  const totalExpenseUSD = sumUSD(periodExpenses)
  const openingBalanceUSD = sumUSD(accountIncomes.filter(before)) - sumUSD(accountExpenses.filter(before))
  const netPeriodBalanceUSD = totalIncomeUSD - totalExpenseUSD

  return {
    periodIncomes,
    expensesByProperty,
    totalIncomeUSD,
    totalExpenseUSD,
    openingBalanceUSD,
    netPeriodBalanceUSD,
    accumulatedBalanceUSD: openingBalanceUSD + netPeriodBalanceUSD,
  }
}
