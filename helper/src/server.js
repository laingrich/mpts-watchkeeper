const fs = require('node:fs')
const http = require('node:http')
const { loadConfig } = require('./config')
const { verifyHelperCapability } = require('./capability')
const {
  GudeError,
  getStatus,
  performAction,
  renamePort,
  validateAction
} = require('./gudeClient')

const config = loadConfig()
const recentActions = new Map()

const server = http.createServer(async (request, response) => {
  let actionAudit = null
  const origin = request.headers.origin || ''
  const corsHeaders = origin && config.allowedOrigins.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Private-Network': 'true',
        Vary: 'Origin'
      }
    : {}

  if (request.method === 'OPTIONS') {
    return origin && config.allowedOrigins.includes(origin)
      ? send(response, 204, null, corsHeaders)
      : send(response, 403, { error: 'Browser origin is not allowed' })
  }

  if (request.method === 'GET' && request.url === '/health') {
    return send(response, 200, { status: 'ok', service: 'watchkeeper-helper' }, corsHeaders)
  }

  if (!origin || !config.allowedOrigins.includes(origin)) {
    return send(response, 403, { error: 'Browser origin is not allowed' })
  }

  try {
    if (request.method === 'POST' && request.url === '/gude/status') {
      const body = await readBody(request)
      const device = findDevice(body)
      verifyHelperCapability(
        readBearerToken(request),
        config.authorisationPublicKey,
        {
          clientId: device.clientId,
          deviceId: device.deviceId,
          permission: 'gude:operate'
        }
      )
      return send(response, 200, await getStatus(device), corsHeaders)
    }

    if (request.method === 'POST' && request.url === '/gude/action') {
      const body = await readBody(request)
      const device = findDevice(body)
      const port = Number(body.port)
      const action = String(body.action || '')
      const principal = verifyHelperCapability(
        readBearerToken(request),
        config.authorisationPublicKey,
        {
          clientId: device.clientId,
          deviceId: device.deviceId,
          permission: 'gude:operate'
        }
      )
      actionAudit = {
        clientId: device.clientId,
        deviceId: device.deviceId,
        port,
        action,
        actor: principal.actor
      }
      validateAction(device, port, action)
      enforceCooldown(device, port)

      const result = await performAction(device, port, action, {
        waitForSettle: async selectedAction => {
          if (selectedAction !== 'reset') {
            await new Promise(resolve => setTimeout(resolve, 250))
          }
        }
      })

      writeAudit({ at: new Date().toISOString(), ...actionAudit, outcome: 'success' })

      return send(response, 200, result, corsHeaders)
    }

    if (request.method === 'POST' && request.url === '/gude/rename') {
      const body = await readBody(request)
      const device = findDevice(body)
      const port = Number(body.port)
      const name = String(body.name || '')
      const principal = verifyHelperCapability(
        readBearerToken(request),
        config.authorisationPublicKey,
        {
          clientId: device.clientId,
          deviceId: device.deviceId,
          permission: 'gude:rename'
        }
      )
      actionAudit = {
        clientId: device.clientId,
        deviceId: device.deviceId,
        port,
        action: 'rename',
        actor: principal.actor,
        newName: name
      }

      const result = await renamePort(device, port, name)
      actionAudit.oldName = result.oldName
      writeAudit({ at: new Date().toISOString(), ...actionAudit, outcome: 'success' })

      return send(response, 200, result.status, corsHeaders)
    }

    return send(response, 404, { error: 'Not found' }, corsHeaders)
  } catch (error) {
    const status = error instanceof GudeError ? error.statusCode : error?.statusCode || 500
    const code = error instanceof GudeError ? error.code : 'HELPER_REQUEST_FAILED'
    if (actionAudit) {
      writeAudit({
        at: new Date().toISOString(),
        ...actionAudit,
        outcome: 'failure',
        code
      })
    }
    console.error('Watchkeeper helper request failed', { code, status })
    return send(response, status, { error: error.message || 'Request failed', code }, corsHeaders)
  }
})

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Watchkeeper helper listening on http://127.0.0.1:${config.port}`)
})

function findDevice(body) {
  const clientId = String(body.clientId || '').trim()
  const deviceId = String(body.deviceId || '').trim()
  const device = config.devices.find(item => item.clientId === clientId && item.deviceId === deviceId)
  if (!device) throw Object.assign(new Error('GUDE device is not configured locally'), { statusCode: 404 })
  return device
}

function enforceCooldown(device, port) {
  const key = `${device.clientId}:${device.deviceId}:${port}`
  const now = Date.now()
  if ((recentActions.get(key) || 0) > now - 5000) {
    throw Object.assign(new Error('Wait before operating this port again'), { statusCode: 429 })
  }
  recentActions.set(key, now)
}

function readBearerToken(request) {
  const value = String(request.headers.authorization || '')
  const match = /^Bearer\s+(.+)$/i.exec(value)
  if (!match) {
    throw Object.assign(new Error('Administrator authorisation is required'), {
      code: 'HELPER_AUTHORISATION_REQUIRED',
      statusCode: 401
    })
  }
  return match[1]
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 16384) throw Object.assign(new Error('Request body is too large'), { statusCode: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Invalid JSON request'), { statusCode: 400 })
  }
}

function writeAudit(entry) {
  if (!config.auditLogPath) return
  fs.appendFileSync(config.auditLogPath, `${JSON.stringify(entry)}\n`, { mode: 0o600 })
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...headers
  })
  response.end(body ? JSON.stringify(body) : undefined)
}
