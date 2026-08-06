const DOMOTZ_REQUEST_TIMEOUT_MS = 10000
const DOMOTZ_MAX_AGENT_PAGES = 10
const DOMOTZ_AGENT_PAGE_SIZE = 100

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

async function domotzRequest(path) {
  const { apiKey, baseUrl } = readConfiguration()
  const url = new URL(path, `${baseUrl}/`)
  let response

  try {
    response = await fetch(url, {
      method: 'GET',
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
    throw responseError(response.status)
  }

  try {
    return await response.json()
  } catch {
    throw new DomotzApiError(
      'Domotz returned an invalid JSON response',
      'DOMOTZ_INVALID_RESPONSE'
    )
  }
}

function readConfiguration() {
  const apiKey = String(process.env.DOMOTZ_API_KEY || '').trim()
  const configuredBaseUrl = String(
    process.env.DOMOTZ_API_BASE_URL || ''
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
  DomotzApiError,
  getAgent,
  getDeviceStatusCounts,
  listAgents
}
