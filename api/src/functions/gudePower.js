const { app } = require('@azure/functions')
const powerDevices = require('../data/domotzPowerDevices.json')
const { getClientPrincipal } = require('../auth/clientPrincipal')
const { canAccessClient } = require('../auth/clientAccess')
const { readClientSettings } = require('../storage/clientSettingsStore')
const {
  DomotzApiError,
  getPowerOutlets,
  triggerPowerOutletAction
} = require('../integrations/domotzClient')

app.http('gudePower', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'gude-power/{clientId}/{deviceId}',
  handler: handleGudePower
})

async function handleGudePower(request, options = {}) {
  const principal = getClientPrincipal(request)
  if (!principal) return json(401, { error: 'Authentication required' })

  const clientId = cleanId(request.params.clientId, 200)
  const watchkeeperDeviceId = cleanId(request.params.deviceId, 120)
  if (!clientId || !watchkeeperDeviceId) {
    return json(400, { error: 'Invalid power-control request' })
  }

  if (!canAccessClient(principal, clientId)) {
    return json(403, { error: 'Access to this client is not permitted' })
  }

  const device = powerDevices[clientId]?.[watchkeeperDeviceId]
  if (!device) {
    return json(404, { error: 'This GUDE device is not linked to Domotz' })
  }

  try {
    const clientSettings = await (
      options.readClientSettings || readClientSettings
    )(clientId)
    const agentId = String(
      clientSettings.settings.integrations?.domotz?.agentId || ''
    ).trim()

    if (!agentId) {
      return json(409, {
        error: 'This client is not linked to a Domotz Collector'
      })
    }

    if (request.method === 'GET') {
      return json(200, await liveStatus(watchkeeperDeviceId, agentId, device), {
        'Cache-Control': 'no-store'
      })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json(400, { error: 'Invalid power-control request body' })
    }
    const port = Number(body?.port)
    const action = String(body?.action || '').trim().toLowerCase()
    const domotzAction = action === 'reset' ? 'cycle' : action

    if (!Number.isInteger(port) || port < 1 || port > 64) {
      return json(400, { error: 'Invalid GUDE outlet number' })
    }
    if (!['on', 'off', 'cycle'].includes(domotzAction)) {
      return json(400, { error: 'Unsupported GUDE power action' })
    }

    const outlets = await getPowerOutlets(agentId, device.deviceId)
    const outlet = outlets.find(item => item.number === port)
    if (!outlet) return json(404, { error: 'The GUDE outlet was not found' })
    if (!outlet.canWrite) {
      return json(409, { error: 'Domotz reports this outlet as read-only' })
    }

    const audit = {
      at: new Date().toISOString(),
      actor: principal.userDetails || principal.userId || 'unknown',
      clientId,
      watchkeeperDeviceId,
      domotzAgentId: agentId,
      domotzDeviceId: device.deviceId,
      outletId: outlet.id,
      outletName: outlet.name,
      action: domotzAction
    }

    try {
      await triggerPowerOutletAction(
        agentId,
        device.deviceId,
        outlet.id,
        domotzAction
      )
      console.info('Watchkeeper GUDE power action accepted', {
        ...audit,
        outcome: 'accepted'
      })
    } catch (error) {
      console.error('Watchkeeper GUDE power action failed', {
        ...audit,
        outcome: 'failure',
        code: error?.code || 'DOMOTZ_POWER_FAILED'
      })
      throw error
    }

    return json(202, {
      accepted: true,
      action: domotzAction,
      port,
      requestedAt: audit.at
    }, { 'Cache-Control': 'no-store' })
  } catch (error) {
    const status = error instanceof DomotzApiError
      ? error.statusCode
      : 500
    console.error('GUDE power request failed', {
      code: error?.code || 'GUDE_POWER_FAILED',
      status
    })
    return json(status, {
      error: error instanceof DomotzApiError
        ? error.message
        : 'Unable to complete the GUDE power request'
    })
  }
}

async function liveStatus(watchkeeperDeviceId, agentId, device) {
  const ports = await getPowerOutlets(agentId, device.deviceId)
  return {
    deviceId: watchkeeperDeviceId,
    model: device.model,
    ports,
    checkedAt: new Date().toISOString(),
    dataSource: 'domotz'
  }
}

function cleanId(value, maximum) {
  const text = String(value || '').trim()
  return text && text.length <= maximum ? text : ''
}

function json(status, jsonBody, headers = {}) {
  return {
    status,
    jsonBody,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }
}

module.exports = { handleGudePower, liveStatus }
