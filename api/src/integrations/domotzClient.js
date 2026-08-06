const DOMOTZ_REQUEST_TIMEOUT_MS = 10000
const DOMOTZ_MAX_AGENT_PAGES = 10
const DOMOTZ_AGENT_PAGE_SIZE = 100
const DOMOTZ_DEVICE_VARIABLE_PAGE_SIZE = 1000
const DEFAULT_UPS_HISTORY_DAYS = 30
const POWER_ACTIONS = new Set(['on', 'off', 'cycle'])
const UPS_VARIABLE_NAMES = {
  alarms: 'upsAlarmsPresent',
  batteryStatus: 'upsBatteryStatus',
  batteryVoltage: 'upsBatteryVoltage',
  estimatedMinutes: 'upsEstimatedMinutesRemaining',
  estimatedCharge: 'upsEstimatedChargeRemaining',
  outputSource: 'upsOutputSource'
}

class DomotzApiError extends Error {
  constructor(message, code, statusCode = 502) {
    super(message)
    this.name = 'DomotzApiError'
    this.code = code
    this.statusCode = statusCode
  }
}

async function listAgents() {
  const agents = []

  for (
    let pageNumber = 0;
    pageNumber < DOMOTZ_MAX_AGENT_PAGES;
    pageNumber += 1
  ) {
    const page = await domotzRequest(
      `agent?page_size=${DOMOTZ_AGENT_PAGE_SIZE}&page_number=${pageNumber}`
    )

    if (!Array.isArray(page)) {
      throw new DomotzApiError(
        'Domotz returned an invalid Collector list',
        'DOMOTZ_INVALID_RESPONSE'
      )
    }

    agents.push(
      ...page
        .map(normaliseAgentSummary)
        .filter(agent => agent !== null)
    )

    if (page.length < DOMOTZ_AGENT_PAGE_SIZE) {
      return agents.sort((left, right) =>
        left.name.localeCompare(right.name, 'en-GB', {
          sensitivity: 'base'
        })
      )
    }
  }

  throw new DomotzApiError(
    'Domotz Collector pagination exceeded 1000 records',
    'DOMOTZ_PAGINATION_LIMIT'
  )
}

async function getAgent(agentId) {
  const id = validateAgentId(agentId)
  const value = await domotzRequest(`agent/${id}`)
  const agent = normaliseAgentDetail(value)

  if (!agent) {
    throw new DomotzApiError(
      'Domotz returned an invalid Collector record',
      'DOMOTZ_INVALID_RESPONSE'
    )
  }

  return agent
}

async function getDeviceStatusCounts(agentId) {
  const id = validateAgentId(agentId)
  const value = await domotzRequest(
    `agent/${id}/device?show_hidden=false`
  )

  if (!Array.isArray(value)) {
    throw new DomotzApiError(
      'Domotz returned an invalid device list',
      'DOMOTZ_INVALID_RESPONSE'
    )
  }

  const counts = {
    visibleTotal: 0,
    importantTotal: 0,
    importantOnline: 0,
    importantOffline: 0,
    importantDown: 0,
    importantUnknown: 0,
    otherVisible: 0
  }

  for (const device of value) {
    if (!device || typeof device !== 'object') {
      continue
    }

    counts.visibleTotal += 1

    if (statusValue(device.importance) !== 'VITAL') {
      counts.otherVisible += 1
      continue
    }

    counts.importantTotal += 1

    const status = statusValue(device.status)

    if (status === 'ONLINE') {
      counts.importantOnline += 1
    } else if (status === 'OFFLINE') {
      counts.importantOffline += 1
    } else if (status === 'DOWN') {
      counts.importantDown += 1
    } else {
      counts.importantUnknown += 1
    }
  }

  return counts
}

async function getUpsMonitoring(agentId, options = {}) {
  const id = validateAgentId(agentId)
  const historyDays = normaliseHistoryDays(options.historyDays)
  const now = normaliseDate(options.now) || new Date()
  const historyFrom = new Date(
    now.getTime() - historyDays * 24 * 60 * 60 * 1000
  )
  const devices = await domotzRequest(
    `agent/${id}/device?show_hidden=false`,
    options
  )

  if (!Array.isArray(devices)) {
    throw new DomotzApiError(
      'Domotz returned an invalid device list',
      'DOMOTZ_INVALID_RESPONSE'
    )
  }

  const eatonDevices = devices.filter(device =>
    device &&
    typeof device === 'object' &&
    /\beaton\b/i.test(String(device.vendor || ''))
  )

  const monitoredDevices = []

  for (const device of eatonDevices) {
    const deviceId = numericId(device.id)
    if (!deviceId) continue

    const variables = await domotzRequest(
      `agent/${id}/device/${deviceId}/variable?page_size=${DOMOTZ_DEVICE_VARIABLE_PAGE_SIZE}&page_number=0`,
      { ...options, responseErrorFactory: upsResponseError }
    )

    if (!Array.isArray(variables)) {
      throw new DomotzApiError(
        'Domotz returned an invalid device variable list',
        'DOMOTZ_INVALID_RESPONSE'
      )
    }

    const upsVariables = indexUpsVariables(variables)
    if (!upsVariables.outputSource) continue

    const history = await domotzRequest(
      `agent/${id}/device/${deviceId}/variable/${requiredNumericId(upsVariables.outputSource.id, 'variable')}/history?from=${encodeURIComponent(domotzDateTime(historyFrom))}&to=${encodeURIComponent(domotzDateTime(now))}`,
      { ...options, responseErrorFactory: upsResponseError }
    )

    if (!Array.isArray(history)) {
      throw new DomotzApiError(
        'Domotz returned invalid UPS history',
        'DOMOTZ_INVALID_RESPONSE'
      )
    }

    monitoredDevices.push(
      normaliseUpsDevice(device, upsVariables, history, {
        historyFrom,
        historyTo: now
      })
    )
  }

  return {
    historyDays,
    historyFrom: historyFrom.toISOString(),
    historyTo: now.toISOString(),
    devices: monitoredDevices.sort((left, right) =>
      `${left.zone} ${left.location} ${left.name}`.localeCompare(
        `${right.zone} ${right.location} ${right.name}`,
        'en-GB',
        { sensitivity: 'base' }
      )
    )
  }
}

async function getPowerOutlets(agentId, deviceId, options = {}) {
  const value = await domotzRequest(
    `agent/${requiredNumericId(agentId, 'Collector')}/device/${requiredNumericId(deviceId, 'device')}/power-outlet`,
    { ...options, responseErrorFactory: powerResponseError }
  )

  if (!Array.isArray(value)) {
    throw new DomotzApiError(
      'Domotz returned an invalid outlet list',
      'DOMOTZ_INVALID_RESPONSE'
    )
  }

  const outlets = value
    .map(normalisePowerOutlet)
    .filter(outlet => outlet !== null)
    .sort((left, right) => left.number - right.number)

  if (outlets.length === 0 && value.length > 0) {
    throw new DomotzApiError(
      'Domotz returned outlets with unsupported identifiers',
      'DOMOTZ_INVALID_RESPONSE'
    )
  }

  return outlets
}

async function triggerPowerOutletAction(
  agentId,
  deviceId,
  outletId,
  action,
  options = {}
) {
  const selectedAction = String(action || '').trim().toLowerCase()
  if (!POWER_ACTIONS.has(selectedAction)) {
    throw new DomotzApiError(
      'Unsupported power action',
      'DOMOTZ_INVALID_ACTION',
      400
    )
  }

  await domotzRequest(
    `agent/${requiredNumericId(agentId, 'Collector')}/device/${requiredNumericId(deviceId, 'device')}/power-outlet/${requiredNumericId(outletId, 'outlet')}/action/${selectedAction}`,
    {
      ...options,
      method: 'POST',
      responseErrorFactory: powerResponseError
    }
  )
}

async function domotzRequest(path, options = {}) {
  const { apiKey, baseUrl } = readConfiguration(options.configuration)
  const fetchImpl = options.fetchImpl || fetch
  const url = new URL(path, `${baseUrl}/`)
  let response

  try {
    response = await fetchImpl(url, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        'X-Api-Key': apiKey
      },
      redirect: 'error',
      signal: AbortSignal.timeout(DOMOTZ_REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    throw new DomotzApiError(
      error?.name === 'TimeoutError'
        ? 'Domotz did not respond in time'
        : 'Unable to reach the Domotz API',
      error?.name === 'TimeoutError'
        ? 'DOMOTZ_TIMEOUT'
        : 'DOMOTZ_UNAVAILABLE'
    )
  }

  if (!response.ok) {
    throw (options.responseErrorFactory || responseError)(response.status)
  }

  if (response.status === 202 || response.status === 204) return null

  try {
    return await response.json()
  } catch {
    throw new DomotzApiError(
      'Domotz returned an invalid JSON response',
      'DOMOTZ_INVALID_RESPONSE'
    )
  }
}

function readConfiguration(configuration) {
  const apiKey = String(
    configuration?.apiKey ?? process.env.DOMOTZ_API_KEY ?? ''
  ).trim()
  const configuredBaseUrl = String(
    configuration?.baseUrl ?? process.env.DOMOTZ_API_BASE_URL ?? ''
  ).trim()

  if (!apiKey || !configuredBaseUrl) {
    throw new DomotzApiError(
      'Domotz API is not configured for this environment',
      'DOMOTZ_NOT_CONFIGURED',
      503
    )
  }

  let parsed

  try {
    parsed = new URL(configuredBaseUrl)
  } catch {
    throw new DomotzApiError(
      'Domotz API endpoint is invalid',
      'DOMOTZ_INVALID_CONFIGURATION',
      503
    )
  }

  if (
    parsed.protocol !== 'https:' ||
    !(
      parsed.hostname === 'domotz.com' ||
      parsed.hostname.endsWith('.domotz.com')
    ) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new DomotzApiError(
      'Domotz API endpoint is invalid',
      'DOMOTZ_INVALID_CONFIGURATION',
      503
    )
  }

  return {
    apiKey,
    baseUrl: parsed.toString().replace(/\/$/, '')
  }
}

function responseError(status) {
  if (status === 401 || status === 403) {
    return new DomotzApiError(
      'Domotz rejected the configured API key',
      'DOMOTZ_AUTHENTICATION_FAILED',
      502
    )
  }

  if (status === 404) {
    return new DomotzApiError(
      'The linked Domotz Collector was not found',
      'DOMOTZ_AGENT_NOT_FOUND',
      404
    )
  }

  if (status === 429) {
    return new DomotzApiError(
      'Domotz API rate limit reached',
      'DOMOTZ_RATE_LIMITED',
      503
    )
  }

  return new DomotzApiError(
    'Domotz API request failed',
    'DOMOTZ_UPSTREAM_ERROR'
  )
}

function powerResponseError(status) {
  if (status === 401 || status === 403) {
    return new DomotzApiError(
      'Domotz rejected the configured API key or power action',
      'DOMOTZ_AUTHENTICATION_FAILED'
    )
  }

  if (status === 404) {
    return new DomotzApiError(
      'The linked Domotz outlet was not found',
      'DOMOTZ_OUTLET_NOT_FOUND',
      404
    )
  }

  return responseError(status)
}

function upsResponseError(status) {
  if (status === 404) {
    return new DomotzApiError(
      'The UPS monitoring data was not found in Domotz',
      'DOMOTZ_UPS_DATA_NOT_FOUND',
      404
    )
  }

  return responseError(status)
}

function normaliseAgentSummary(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const id = numericId(value.id)
  const name = cleanText(value.display_name, 250)

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    status: statusValue(value.status),
    lastChange: dateTime(value.status?.last_change),
    apiEnabled: value.access_right?.api_enabled !== false
  }
}

function normaliseAgentDetail(value) {
  const base = normaliseAgentSummary(value)

  if (!base) {
    return null
  }

  return {
    ...base,
    timezone: cleanText(value.timezone, 100),
    organization: cleanText(value.organization?.name, 250)
  }
}

function normalisePowerOutlet(value) {
  if (!value || typeof value !== 'object') return null
  const id = String(value.id ?? '').trim()
  if (!/^\d{1,4}$/.test(id)) return null

  const power = String(value.power || '').trim().toUpperCase()
  return {
    id,
    number: Number(id),
    name: cleanText(value.name, 200) || `Power Port ${id}`,
    state: power === 'ON' ? 'on' : power === 'OFF' ? 'off' : 'unknown',
    canWrite: value.can_write === true
  }
}

function indexUpsVariables(variables) {
  const result = {}

  for (const variable of variables) {
    if (!variable || typeof variable !== 'object') continue
    const path = cleanText(variable.path, 500)
    if (!path.includes('/ups-basic-info/')) continue

    for (const [name, suffix] of Object.entries(UPS_VARIABLE_NAMES)) {
      if (path.endsWith(`/${suffix}`)) result[name] = variable
    }
  }

  return result
}

function normaliseUpsDevice(device, variables, history, window) {
  const outputSource = variableText(variables.outputSource).toLowerCase()
  const historySamples = history
    .map(sample => ({
      timestamp: dateTime(sample?.timestamp),
      value: cleanText(sample?.value, 100).toLowerCase()
    }))
    .filter(sample => sample.timestamp && sample.value)
  const transfers = batteryTransferEvents(historySamples, outputSource)
  const relevantVariables = Object.values(variables).filter(Boolean)
  const observedAt = relevantVariables
    .map(variable => dateTime(variable.value_update_time))
    .filter(Boolean)
    .sort()
    .at(-1) || null

  return {
    id: numericId(device.id),
    name: cleanText(device.display_name, 250) || 'Eaton UPS',
    vendor: cleanText(device.vendor, 250) || 'Eaton',
    model:
      cleanText(device.model, 250) ||
      cleanText(device.user_data?.model, 250),
    location: cleanText(device.details?.room, 200),
    zone: cleanText(device.details?.zone, 200),
    status: statusValue(device.status),
    importance: statusValue(device.importance),
    outputSource: outputSource || 'unknown',
    batteryStatus:
      variableText(variables.batteryStatus).toLowerCase() || 'unknown',
    batteryChargePercent: variableNumber(variables.estimatedCharge),
    estimatedMinutesRemaining: variableNumber(variables.estimatedMinutes),
    batteryVoltage: variableNumber(variables.batteryVoltage),
    alarmsPresent: variableNumber(variables.alarms),
    observedAt,
    historyFrom: window.historyFrom.toISOString(),
    historyTo: window.historyTo.toISOString(),
    batteryTransfers: transfers
  }
}

function batteryTransferEvents(samples, currentOutputSource) {
  const ordered = samples
    .map(sample => ({
      timestamp: dateTime(sample?.timestamp),
      value: cleanText(sample?.value, 100).toLowerCase()
    }))
    .filter(sample => sample.timestamp && sample.value)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
  const events = []
  let startedAt = null

  for (const sample of ordered) {
    if (sample.value === 'battery') {
      if (!startedAt) startedAt = sample.timestamp
      continue
    }

    if (!startedAt) continue
    events.push(transferEvent(startedAt, sample.timestamp))
    startedAt = null
  }

  if (startedAt || currentOutputSource === 'battery') {
    const currentStart = startedAt || ordered
      .filter(sample => sample.value === 'battery')
      .at(-1)?.timestamp || null
    events.push(transferEvent(currentStart, null))
  }

  return events.reverse()
}

function transferEvent(startedAt, endedAt) {
  const durationSeconds = startedAt && endedAt
    ? Math.max(
      0,
      Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) /
        1000
      )
    )
    : null

  return { startedAt, endedAt, durationSeconds }
}

function variableText(variable) {
  return cleanText(variable?.value, 100)
}

function variableNumber(variable) {
  if (variable?.value === undefined || variable?.value === null) {
    return null
  }

  const value = Number(variable.value)
  return Number.isFinite(value) ? value : null
}

function normaliseHistoryDays(value) {
  const days = Number(value)
  if (!Number.isFinite(days)) return DEFAULT_UPS_HISTORY_DAYS
  return Math.min(Math.max(Math.trunc(days), 1), 31)
}

function normaliseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function domotzDateTime(value) {
  return value.toISOString().slice(0, 19)
}

function validateAgentId(value) {
  const id = String(value || '').trim()

  if (!/^\d{1,20}$/.test(id)) {
    throw new DomotzApiError(
      'Invalid Domotz Collector ID',
      'DOMOTZ_INVALID_AGENT_ID',
      400
    )
  }

  return id
}

function numericId(value) {
  const id = String(value ?? '').trim()
  return /^\d{1,20}$/.test(id) ? id : ''
}

function requiredNumericId(value, label) {
  const id = String(value ?? '').trim()
  if (!/^\d{1,20}$/.test(id)) {
    throw new DomotzApiError(
      `Invalid Domotz ${label} ID`,
      'DOMOTZ_INVALID_ID',
      400
    )
  }
  return id
}

function statusValue(value) {
  const status =
    typeof value === 'string'
      ? value
      : typeof value?.value === 'string'
        ? value.value
        : ''

  return status.trim().toUpperCase() || 'UNKNOWN'
}

function cleanText(value, maxLength) {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : ''
}

function dateTime(value) {
  if (typeof value !== 'string') {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString()
}

module.exports = {
  batteryTransferEvents,
  DomotzApiError,
  getAgent,
  getDeviceStatusCounts,
  getPowerOutlets,
  getUpsMonitoring,
  listAgents,
  normalisePowerOutlet,
  triggerPowerOutletAction
}
