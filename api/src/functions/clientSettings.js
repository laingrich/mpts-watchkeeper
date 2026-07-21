const { app } = require('@azure/functions')
const {
  getClientPrincipal,
  hasAnyRole
} = require('../auth/clientPrincipal')
const {
  readClientSettings,
  writeClientSettings
} = require('../storage/clientSettingsStore')
const {
  mergeClientSettings
} = require('../settings/clientSettingsSchema')

const allowedRoles = [
  'watchkeeper_admin',
  'watchkeeper_engineer'
]

const adminRoles = [
  'watchkeeper_admin'
]

app.http('clientSettings', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  route: 'client-settings/{clientId}',

  handler: async request => {
    const principal = getClientPrincipal(request)

    if (!principal) {
      return json(401, {
        error: 'Authentication required'
      })
    }

    if (!hasAnyRole(principal, allowedRoles)) {
      return json(403, {
        error:
          'Administrator or engineer access is required'
      })
    }

    const clientId = request.params.clientId

    if (!clientId || String(clientId).length > 200) {
      return json(400, {
        error: 'Invalid Jetbuilt client ID'
      })
    }

    try {
      const current = await readClientSettings(clientId)

      if (request.method === 'GET') {
        return json(200, current, {
          'Cache-Control': 'no-store'
        })
      }

      const body = await request.json()

      if (
        !hasAnyRole(principal, adminRoles) &&
        !isDocumentLinkOnlyUpdate(body)
      ) {
        return json(403, {
          error:
            'Administrator access is required to change site configuration'
        })
      }

      const settings = mergeClientSettings(
        current.settings,
        body
      )
      const expectedEtag =
        request.headers.get('if-match')

      const result = await writeClientSettings(
        clientId,
        settings,
        principal.userDetails ||
          principal.userId ||
          'unknown',
        expectedEtag
      )

      return json(200, result, {
        'Cache-Control': 'no-store'
      })
    } catch (error) {
      console.error(
        'Client settings request failed',
        error
      )

      if (error?.statusCode === 412) {
        return json(409, {
          error:
            'The client settings were changed by another user'
        })
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save client settings'

      return json(
        message.startsWith('Invalid') ||
        message.includes('required') ||
        message.includes('too long')
          ? 400
          : 500,
        { error: message }
      )
    }
  }
})

function isDocumentLinkOnlyUpdate(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false
  }

  const keys = Object.keys(value)
  const allowedKeys = new Set([
    'sharePointUrl',
    'arturaUrl'
  ])

  return (
    keys.length > 0 &&
    keys.every(key => allowedKeys.has(key))
  )
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
