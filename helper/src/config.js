const fs = require('node:fs')
const path = require('node:path')

function loadConfig(configPath = process.env.WATCHKEEPER_HELPER_CONFIG) {
  const resolved = path.resolve(
    configPath || path.join(__dirname, '..', 'local.config.json')
  )

  let parsed

  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  } catch (error) {
    throw new Error(
      `Unable to read Watchkeeper helper configuration at ${resolved}: ${error.message}`
    )
  }

  return validateConfig(parsed, resolved)
}

function validateConfig(value, sourcePath = '') {
  if (!value || typeof value !== 'object') {
    throw new Error('Helper configuration must be an object')
  }

  const allowedOrigins = Array.isArray(value.allowedOrigins)
    ? value.allowedOrigins.map(origin => validateOrigin(origin))
    : []

  if (allowedOrigins.length === 0) {
    throw new Error('At least one allowed browser origin is required')
  }

  if (!Array.isArray(value.devices) || value.devices.length === 0) {
    throw new Error('At least one GUDE device is required')
  }

  const devices = value.devices.map(validateDevice)
  const keys = new Set()

  for (const device of devices) {
    const key = `${device.clientId}:${device.deviceId}`
    if (keys.has(key)) throw new Error(`Duplicate GUDE device: ${key}`)
    keys.add(key)
  }

  const port = Number(value.port ?? 47832)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Helper port must be between 1024 and 65535')
  }

  return {
    port,
    allowedOrigins,
    devices,
    authorisationPublicKey: optionalText(
      value.authorisationPublicKey,
      'Helper authorisation public key',
      4096
    ),
    auditLogPath: value.auditLogPath
      ? path.resolve(path.dirname(sourcePath || process.cwd()), String(value.auditLogPath))
      : ''
  }
}

function validateOrigin(value) {
  const origin = new URL(String(value))
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== String(value)) {
    throw new Error(`Invalid allowed origin: ${value}`)
  }
  return origin.origin
}

function validateDevice(value) {
  const clientId = requiredText(value?.clientId, 'GUDE client ID', 200)
  const deviceId = requiredText(value?.deviceId, 'GUDE device ID', 120)
  const username = requiredText(value?.username, 'GUDE username', 200)
  const password = requiredText(value?.password, 'GUDE password', 500)
  const baseUrl = new URL(requiredText(value?.baseUrl, 'GUDE base URL', 2048))

  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    throw new Error(`GUDE device ${deviceId} must use HTTP or HTTPS`)
  }

  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error(`GUDE device ${deviceId} has an invalid base URL`)
  }

  const portCount = Number(value.portCount)
  if (!Number.isInteger(portCount) || portCount < 1 || portCount > 64) {
    throw new Error(`GUDE device ${deviceId} has an invalid port count`)
  }

  const protectedPorts = Array.isArray(value.protectedPorts)
    ? value.protectedPorts.map(port => validatePort(port, portCount, deviceId))
    : []

  return {
    clientId,
    deviceId,
    baseUrl: baseUrl.toString().replace(/\/$/, ''),
    model: requiredText(value.model, 'GUDE model', 200),
    username,
    password,
    snmpWriteCommunity: optionalText(
      value.snmpWriteCommunity,
      `GUDE device ${deviceId} SNMP write community`,
      500
    ),
    portCount,
    protectedPorts: [...new Set(protectedPorts)]
  }
}

function validatePort(value, portCount, deviceId) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > portCount) {
    throw new Error(`GUDE device ${deviceId} has an invalid protected port`)
  }
  return port
}

function requiredText(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`)
  }
  if (value.length > maximum) throw new Error(`${label} is too long`)
  return value.trim()
}

function optionalText(value, label, maximum) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw new Error(`${label} must be text`)
  if (value.length > maximum) throw new Error(`${label} is too long`)
  return value.trim()
}

module.exports = { loadConfig, validateConfig }
