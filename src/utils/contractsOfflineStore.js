const DATABASE_NAME = 'fae-contracts-offline'
const DATABASE_VERSION = 1
const PROPERTIES_STORE = 'properties'
const METADATA_STORE = 'metadata'
const SYNC_METADATA_KEY = 'lastSync'
const CONTRACT_FIELDS = [
  'internetCompany',
  'internetContract',
  'electricity',
  'water',
  'poolMaint',
  'gardenMaint',
  'acct',
  'hoa',
  'insurance',
  'management',
]

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(PROPERTIES_STORE)) {
        database.createObjectStore(PROPERTIES_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function sanitizeProperty(property) {
  const contractsInfo = Object.fromEntries(
    CONTRACT_FIELDS.map(field => [field, String(property.contractsInfo?.[field] || '')])
  )
  return {
    id: property.id,
    name: property.name || '',
    ownerName: property.ownerName || '',
    contractsInfo,
  }
}

export async function saveOfflineContracts(properties) {
  const database = await openDatabase()
  const syncedAt = new Date().toISOString()
  await new Promise((resolve, reject) => {
    const transaction = database.transaction([PROPERTIES_STORE, METADATA_STORE], 'readwrite')
    const propertyStore = transaction.objectStore(PROPERTIES_STORE)
    propertyStore.clear()
    properties.forEach(property => propertyStore.put(sanitizeProperty(property)))
    transaction.objectStore(METADATA_STORE).put({ key: SYNC_METADATA_KEY, syncedAt })
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  database.close()
  return syncedAt
}

export async function readOfflineContracts() {
  const database = await openDatabase()
  const result = await new Promise((resolve, reject) => {
    const transaction = database.transaction([PROPERTIES_STORE, METADATA_STORE], 'readonly')
    const propertiesRequest = transaction.objectStore(PROPERTIES_STORE).getAll()
    const metadataRequest = transaction.objectStore(METADATA_STORE).get(SYNC_METADATA_KEY)
    transaction.oncomplete = () => resolve({
      properties: propertiesRequest.result || [],
      syncedAt: metadataRequest.result?.syncedAt || null,
    })
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
  return result
}
