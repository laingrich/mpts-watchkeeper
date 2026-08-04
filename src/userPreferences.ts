export const WATCHKEEPER_TABS = [
  'Overview',
  'Devices',
  'Documents',
  'Service',
  'Site configuration',
] as const

export type WatchkeeperTab = (typeof WATCHKEEPER_TABS)[number]

export type UserPreferences = {
  version: 1
  lastClientId: string | null
  lastTab: WatchkeeperTab
  showAllClients: boolean
  recentClientIds: string[]
}

type UserPreferencesResponse = {
  preferences?: unknown
  updatedAt?: string | null
}

export function createDefaultUserPreferences(): UserPreferences {
  return {
    version: 1,
    lastClientId: null,
    lastTab: 'Overview',
    showAllClients: false,
    recentClientIds: [],
  }
}

export async function loadUserPreferences() {
  const response = await fetch('/api/user-preferences', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Unable to load user preferences')
  }

  const data = (await response.json()) as UserPreferencesResponse

  return normaliseUserPreferences(data.preferences)
}

export async function saveUserPreferences(
  preferences: UserPreferences,
) {
  const response = await fetch('/api/user-preferences', {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preferences),
  })

  if (!response.ok) {
    throw new Error('Unable to save user preferences')
  }
}

function normaliseUserPreferences(value: unknown): UserPreferences {
  const defaults = createDefaultUserPreferences()

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults
  }

  const source = value as Partial<UserPreferences>
  const lastTab = WATCHKEEPER_TABS.includes(
    source.lastTab as WatchkeeperTab,
  )
    ? (source.lastTab as WatchkeeperTab)
    : defaults.lastTab
  const recentClientIds = Array.isArray(source.recentClientIds)
    ? [
        ...new Set(
          source.recentClientIds.filter(
            clientId =>
              typeof clientId === 'string' &&
              clientId.length > 0 &&
              clientId.length <= 200,
          ),
        ),
      ].slice(0, 5)
    : defaults.recentClientIds

  return {
    version: 1,
    lastClientId:
      typeof source.lastClientId === 'string' &&
      source.lastClientId.length > 0 &&
      source.lastClientId.length <= 200
        ? source.lastClientId
        : null,
    lastTab,
    showAllClients:
      typeof source.showAllClients === 'boolean'
        ? source.showAllClients
        : defaults.showAllClients,
    recentClientIds,
  }
}
