const { app } = require('@azure/functions')
const { getClientPrincipal } = require('../auth/clientPrincipal')
const { issueHelperCapability } = require('../security/helperCapability')
const {
  OPERATE_PERMISSION,
  RENAME_PERMISSION,
  requireGudePermission
} = require('../security/gudeControlAccess')

app.http('gudeAuthorisation', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'gude-authorisation',

  handler: async request => {
    const principal = getClientPrincipal(request)

    try {
      const body = await request.json()
      const clientId = requiredText(body?.clientId, 'Client ID', 200)
      const deviceId = requiredText(body?.deviceId, 'Device ID', 120)
      const permission = requiredText(body?.permission, 'Permission', 80)

      requireGudePermission(
        principal,
        clientId,
        permission,
        process.env.WATCHKEEPER_OPERATOR_CLIENT_ACCESS
      )

      const actor = requiredText(
        principal.userDetails || principal.userId,
        'Authenticated user',
        320
      )
      const result = issueHelperCapability({
        privateKeyBase64: process.env.WATCHKEEPER_HELPER_SIGNING_PRIVATE_KEY,
        actor,
        clientId,
        deviceId,
        permission
      })

      return json(200, result, { 'Cache-Control': 'no-store' })
    } catch (error) {
      console.error('GUDE helper authorisation failed', error)
      const message = error instanceof Error ? error.message : ''
      const status = error?.statusCode || (message.includes('not configured') ? 503 : 400)
      return json(status, {
        error: status === 503
          ? 'GUDE control authorisation is not configured'
          : message || 'Invalid authorisation request'
      })
    }
  }
})

function requiredText(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`)
  }
  if (value.length > maximum) throw new Error(`${label} is too long`)
  return value.trim()
}

function json(status, body, headers = {}) {
  return {
    status,
    jsonBody: body,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }
}

module.exports = { OPERATE_PERMISSION, RENAME_PERMISSION }
