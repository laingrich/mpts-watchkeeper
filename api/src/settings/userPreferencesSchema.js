const DEFAULT_USER_PREFERENCES = Object.freeze({
  version: 1,
  lastClientId: null,
  lastTab: 'Overview',
  showAllClients: false,
  recentClientIds: []
})

const ALLOWED_TABS = new Set([
  'Overview',
  'Devices',
  'Documents',
  'Service',
  'Site configuration'
])

const ALLOWED_KEYS = new Set(
  Object.keys(DEFAULT_USER_PREFERENCES)
)

function normaliseUserPreferences(value) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {}

  return {
    version: 1,
    lastClientId:
      typeof source.lastClientId === 'string' &&
      source.lastClientId.length > 0 &&
      source.lastClientId.length <= 200
        ? source.lastClientId
        : null,
    lastTab: ALLOWED_TABS.has(source.lastTab)
      ? source.lastTab
      : DEFAULT_USER_PREFERENCES.lastTab,
    showAllClients:
      typeof source.showAllClients === 'boolean'
        ? source.showAllClients
        : DEFAULT_USER_PREFERENCES.showAllClients,
    recentClientIds: normaliseRecentClientIds(
      source.recentClientIds
    )
  }
}

function mergeUserPreferences(current, update) {
  if (
    !update ||
    typeof update !== 'object' ||
    Array.isArray(update)
  ) {
    throw new Error('Invalid user preferences')
  }

  const unknownKey = Object.keys(update).find(
    key => !ALLOWED_KEYS.has(key)
  )

  if (unknownKey) {
    throw new Error(`Invalid user preference: ${unknownKey}`)
  }

  if (
    update.version !== undefined &&
    update.version !== 1
  ) {
    throw new Error('Invalid user preference version')
  }

  const next = {
    ...normaliseUserPreferences(current),
    ...update,
    version: 1
  }

  if (
    next.lastClientId !== null &&
    (typeof next.lastClientId !== 'string' ||
      next.lastClientId.length === 0 ||
      next.lastClientId.length > 200)
  ) {
    throw new Error('Invalid last client ID')
  }

  if (!ALLOWED_TABS.has(next.lastTab)) {
    throw new Error('Invalid last tab')
  }

  if (typeof next.showAllClients !== 'boolean') {
    throw new Error('Invalid client-list preference')
  }

  if (!Array.isArray(next.recentClientIds)) {
    throw new Error('Invalid recent clients')
  }

  if (next.recentClientIds.length > 5) {
    throw new Error('A maximum of 5 recent clients is supported')
  }

  if (
    next.recentClientIds.some(
      clientId =>
        typeof clientId !== 'string' ||
        clientId.length === 0 ||
        clientId.length > 200
    )
  ) {
    throw new Error('Invalid recent client ID')
  }

  return {
    ...next,
    recentClientIds: [...new Set(next.recentClientIds)]
  }
}

function normaliseRecentClientIds(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(
      value.filter(
        clientId =>
          typeof clientId === 'string' &&
          clientId.length > 0 &&
          clientId.length <= 200
      )
    )
  ].slice(0, 5)
}

module.exports = {
  mergeUserPreferences,
  normaliseUserPreferences
}
