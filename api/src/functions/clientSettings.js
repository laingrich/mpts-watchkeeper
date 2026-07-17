const { app } = require('@azure/functions')
const {
  getClientPrincipal,
  hasAnyRole
} = require('../auth/clientPrincipal')
const {
  readClientSettings,
  writeClientSettings
} = require('../storage/clientSettingsStore')

const allowedRoles = [
  'watchkeeper_admin',
  'watchkeeper_engineer'
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
      if (request.method === 'GET') {
        const result =
          await readClientSettings(clientId)

        return json(200, result, {
          'Cache-Control': 'no-store'
        })
      }

      const body = await request.json()
      const settings = validateSettings(body)
      const expectedEtag =
        request.headers.get('if-match')

      const result =
        await writeClientSettings(
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
        message.includes('required')
          ? 400
          : 500,
        { error: message }
      )
    }
  }
})

function validateSettings(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid client settings')
  }

  const sharePointUrl =
    typeof value.sharePointUrl === 'string'
      ? value.sharePointUrl.trim()
      : ''

  if (sharePointUrl) {
    let parsed

    try {
      parsed = new URL(sharePointUrl)
    } catch {
      throw new Error('Invalid SharePoint URL')
    }

    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname.endsWith(
        '.sharepoint.com'
      )
    ) {
      throw new Error(
        'Invalid SharePoint URL'
      )
    }
  }

  return {
    sharePointUrl
  }
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
