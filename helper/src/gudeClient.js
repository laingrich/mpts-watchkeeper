const REQUEST_TIMEOUT_MS = 5000

class GudeError extends Error {
  constructor(message, code, statusCode = 502) {
    super(message)
    this.name = 'GudeError'
    this.code = code
    this.statusCode = statusCode
  }
}

async function getStatus(device, options = {}) {
  const fetchImpl = options.fetchImpl || fetch
  const url = new URL('/statusjsn.js', `${device.baseUrl}/`)
  url.searchParams.set('components', '1')
  const response = await request(device, url, fetchImpl)
  return normaliseStatus(await readJson(response), device)
}

async function performAction(device, port, action, options = {}) {
  validateAction(device, port, action)

  const fetchImpl = options.fetchImpl || fetch
  const commandUrl = buildCommandUrl(device.baseUrl, port, action)
  await request(device, commandUrl, fetchImpl)

  if (options.waitForSettle) await options.waitForSettle(action)
  return getStatus(device, { fetchImpl })
}

async function renamePort(device, port, name, options = {}) {
  validatePortName(device, port, name)

  if (!device.snmpWriteCommunity) {
    throw new GudeError(
      'GUDE name editing is not configured for this device',
      'GUDE_RENAME_NOT_CONFIGURED',
      503
    )
  }

  const fetchImpl = options.fetchImpl || fetch
  const before = await getStatus(device, { fetchImpl })
  const oldName = before.ports.find(item => item.number === port)?.name
  const oid = buildPortNameOid(device.model, port)
  const snmpSetImpl = options.snmpSetImpl || setPortNameOverSnmp

  await snmpSetImpl({
    host: new URL(device.baseUrl).hostname,
    community: device.snmpWriteCommunity,
    oid,
    name
  })

  if (options.waitForSettle) {
    await options.waitForSettle()
  } else {
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  const status = await getStatus(device, { fetchImpl })
  const savedName = status.ports.find(item => item.number === port)?.name
  if (savedName !== name) {
    throw new GudeError(
      'The GUDE did not confirm the new port name',
      'GUDE_RENAME_NOT_CONFIRMED'
    )
  }

  return { status, oldName, newName: savedName }
}

function validateAction(device, port, action) {
  if (!['on', 'off', 'reset'].includes(action)) {
    throw new GudeError('Unsupported GUDE action', 'GUDE_INVALID_ACTION', 400)
  }

  if (!Number.isInteger(port) || port < 1 || port > device.portCount) {
    throw new GudeError('Invalid GUDE port', 'GUDE_INVALID_PORT', 400)
  }

  if (device.protectedPorts.includes(port)) {
    throw new GudeError(
      'This GUDE port is protected from remote switching',
      'GUDE_PORT_PROTECTED',
      403
    )
  }
}

function validatePortName(device, port, name) {
  if (!Number.isInteger(port) || port < 1 || port > device.portCount) {
    throw new GudeError('Invalid GUDE port', 'GUDE_INVALID_PORT', 400)
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new GudeError('A port name is required', 'GUDE_INVALID_PORT_NAME', 400)
  }

  if (name !== name.trim() || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new GudeError(
      'Port names cannot start or end with spaces or contain control characters',
      'GUDE_INVALID_PORT_NAME',
      400
    )
  }

  if (Buffer.byteLength(name, 'utf8') > 15) {
    throw new GudeError(
      'GUDE port names are limited to 15 characters',
      'GUDE_INVALID_PORT_NAME',
      400
    )
  }
}

function buildPortNameOid(model, port) {
  const text = String(model || '')
  const modelRoot = /8041/.test(text)
    ? '1.3.6.1.4.1.28507.85'
    : /8031/.test(text)
      ? '1.3.6.1.4.1.28507.81'
      : ''

  if (!modelRoot) {
    throw new GudeError(
      'Port name editing is not supported for this GUDE model',
      'GUDE_RENAME_UNSUPPORTED',
      400
    )
  }

  return `${modelRoot}.1.3.1.2.1.2.${port}`
}

async function setPortNameOverSnmp({ host, community, oid, name }) {
  const snmp = require('net-snmp')

  await new Promise((resolve, reject) => {
    const session = snmp.createSession(host, community, {
      version: snmp.Version2c,
      retries: 1,
      timeout: REQUEST_TIMEOUT_MS
    })

    session.set([{
      oid,
      type: snmp.ObjectType.OctetString,
      value: Buffer.from(name, 'utf8')
    }], error => {
      session.close()
      if (error) {
        reject(new GudeError(
          'The GUDE rejected the port name change',
          'GUDE_RENAME_FAILED'
        ))
        return
      }
      resolve()
    })
  })
}

function buildCommandUrl(baseUrl, port, action) {
  const url = new URL(action === 'reset' ? '/' : '/ov.html', `${baseUrl}/`)
  url.searchParams.set('cmd', action === 'reset' ? '12' : '1')
  url.searchParams.set('p', String(port))
  if (action !== 'reset') url.searchParams.set('s', action === 'on' ? '1' : '0')
  return url
}

async function request(device, url, fetchImpl) {
  let response

  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/html;q=0.8',
        Authorization: `Basic ${Buffer.from(`${device.username}:${device.password}`).toString('base64')}`
      },
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    throw new GudeError(
      error?.name === 'TimeoutError'
        ? 'The GUDE device did not respond in time'
        : 'Unable to reach the GUDE device',
      error?.name === 'TimeoutError' ? 'GUDE_TIMEOUT' : 'GUDE_UNAVAILABLE'
    )
  }

  if (response.status === 401 || response.status === 403) {
    throw new GudeError(
      'The GUDE device rejected its configured credentials',
      'GUDE_AUTHENTICATION_FAILED',
      502
    )
  }

  if (!response.ok) {
    throw new GudeError('The GUDE device request failed', 'GUDE_UPSTREAM_ERROR')
  }

  return response
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    throw new GudeError('The GUDE device returned invalid status data', 'GUDE_INVALID_RESPONSE')
  }
}

function normaliseStatus(value, device) {
  if (!value || !Array.isArray(value.outputs)) {
    throw new GudeError('The GUDE device returned invalid status data', 'GUDE_INVALID_RESPONSE')
  }

  const ports = value.outputs.slice(0, device.portCount).map((output, index) => ({
    number: index + 1,
    name: cleanText(output?.name, 200) || `Power Port ${index + 1}`,
    state: output?.state === 1 ? 'on' : output?.state === 0 ? 'off' : 'unknown',
    resetting: Array.isArray(output?.batch) && Number(output.batch[1]) > 0,
    protected: device.protectedPorts.includes(index + 1)
  }))

  return {
    deviceId: device.deviceId,
    model: device.model,
    ports,
    checkedAt: new Date().toISOString(),
    dataSource: 'live'
  }
}

function cleanText(value, maximum) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : ''
}

module.exports = {
  GudeError,
  buildCommandUrl,
  buildPortNameOid,
  getStatus,
  normaliseStatus,
  performAction,
  renamePort,
  validateAction,
  validatePortName
}
