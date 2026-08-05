const { app } = require('@azure/functions')
const { getClientPrincipal } = require('../auth/clientPrincipal')
const { hasWatchkeeperAccess } = require('../auth/clientAccess')
const {
  mergeUserPreferences
} = require('../settings/userPreferencesSchema')
const {
  readUserPreferences,
  writeUserPreferences
} = require('../storage/userPreferencesStore')

app.http('userPreferences', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  route: 'user-preferences',

  handler: async request => {
    const principal = getClientPrincipal(request)

    if (!principal) {
      return json(401, {
        error: 'Authentication required'
      })
    }

    if (!hasWatchkeeperAccess(principal)) {
      return json(403, {
        error: 'Watchkeeper access is required'
      })
    }

    const userIdentity = getUserIdentity(principal)

    if (!userIdentity) {
      return json(400, {
        error: 'Authenticated user ID is required'
      })
    }

    try {
      const current = await readUserPreferences(userIdentity)

      if (request.method === 'GET') {
        return json(200, current, {
          'Cache-Control': 'no-store'
        })
      }

      const preferences = mergeUserPreferences(
        current.preferences,
        await request.json()
      )
      const result = await writeUserPreferences(
        userIdentity,
        preferences
      )

      return json(200, result, {
        'Cache-Control': 'no-store'
      })
    } catch (error) {
      console.error('User preferences request failed', error)

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save user preferences'

      return json(
        message.startsWith('Invalid') ||
        message.includes('maximum')
          ? 400
          : 500,
        { error: message }
      )
    }
  }
})

function getUserIdentity(principal) {
  const userId =
    typeof principal.userId === 'string'
      ? principal.userId.trim()
      : ''

  if (!userId || userId.length > 500) {
    return null
  }

  const identityProvider =
    typeof principal.identityProvider === 'string' &&
    principal.identityProvider.length <= 100
      ? principal.identityProvider
      : 'unknown'

  return `${identityProvider}:${userId}`
}

function json(status, jsonBody, headers = {}) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    jsonBody
  }
}
