const { hasAnyRole } = require('./clientPrincipal')

const ENGINEERING_ROLES = [
  'watchkeeper_admin',
  'watchkeeper_engineer'
]
const OPERATOR_ROLE = 'watchkeeper_operator'
const WATCHKEEPER_ROLES = [...ENGINEERING_ROLES, OPERATOR_ROLE]

function hasWatchkeeperAccess(principal) {
  return hasAnyRole(principal, WATCHKEEPER_ROLES)
}

function canEditEngineeringData(principal) {
  return hasAnyRole(principal, ENGINEERING_ROLES)
}

function canAccessClient(
  principal,
  clientId,
  accessSetting = process.env.WATCHKEEPER_OPERATOR_CLIENT_ACCESS
) {
  if (canEditEngineeringData(principal)) return true
  if (!hasAnyRole(principal, [OPERATOR_ROLE])) return false
  return getOperatorClientIds(principal, accessSetting).has(String(clientId))
}

function filterAccessibleClients(principal, clients, accessSetting) {
  if (canEditEngineeringData(principal)) return clients
  const allowedIds = getOperatorClientIds(principal, accessSetting)
  return clients.filter(client => allowedIds.has(String(client.id)))
}

function getOperatorClientIds(principal, accessSetting) {
  if (!accessSetting) return new Set()

  let access
  try {
    access = JSON.parse(accessSetting)
  } catch {
    return new Set()
  }
  if (!access || typeof access !== 'object' || Array.isArray(access)) {
    return new Set()
  }

  const keys = [principal?.userId, principal?.userDetails]
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim().toLowerCase())
  const clientIds = keys.flatMap(key => Array.isArray(access[key]) ? access[key] : [])

  return new Set(clientIds.map(String))
}

module.exports = {
  ENGINEERING_ROLES,
  OPERATOR_ROLE,
  WATCHKEEPER_ROLES,
  canAccessClient,
  canEditEngineeringData,
  filterAccessibleClients,
  hasWatchkeeperAccess
}
