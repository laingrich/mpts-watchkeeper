const { app } = require('@azure/functions')
const {
  getClientPrincipal,
  hasAnyRole
} = require('../auth/clientPrincipal')
const {
  readClientSettings
} = require('../storage/clientSettingsStore')
const {
  DomotzApiError,
  getAgent,
  getDeviceStatusCounts,
  getUpsMonitoring,
  listAgents
} = require('../integrations/domotzClient')

const allowedRoles = [
  'watchkeeper_admin',
  'watchkeeper_engineer'
]

const adminRoles = ['watchkeeper_admin']
const defaultCacheTtlMs = 60000
const maximumCacheTtlMs = 300000

let agentsCache = null
const statusCache = new Map()
const upsCache = new Map()
const upsRequests = new Map()

app.http('domotzAgents', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'domotz/agents',

  handler: async request => {
    const principal = getClientPrincipal(request)

    if (!principal) {
      return json(401, { error: 'Authentication required' })
    }

    if (!hasAnyRole(principal, adminRoles)) {
      return json(403, {
        error: 'Administrator access is required to link Domotz Collectors'
      })
    }

    try {
      const forceRefresh = request.query.get('refresh') === 'true'
      const result = await cachedAgents(forceRefresh)

      return json(
        200,
        {
          agents: result.value,
          count: result.value.length,
          fetchedAt: result.fetchedAt,
          cached: result.cached
        },
        { 'Cache-Control': 'no-store' }
      )
    } catch (error) {
      return domotzError('Collector list', error)
    }
  }
})

app.http('domotzStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'domotz/status/{clientId}',

  handler: async request => {
    const principal = getClientPrincipal(request)

    if (!principal) {
      return json(401, { error: 'Authentication required' })
    }

    if (!hasAnyRole(principal, allowedRoles)) {
      return json(403, {
        error: 'Administrator or engineer access is required'
      })
    }

    const clientId = String(request.params.clientId || '').trim()

    if (!clientId || clientId.length > 200) {
      return json(400, { error: 'Invalid Jetbuilt client ID' })
    }

    try {
      const clientSettings = await readClientSettings(clientId)
      const agentId =
        clientSettings.settings.integrations?.domotz?.agentId || ''

      if (!agentId) {
        return json(
          200,
          {
            state: 'not-linked',
            fetchedAt: null
          },
          { 'Cache-Control': 'no-store' }
        )
      }

      const forceRefresh = request.query.get('refresh') === 'true'
      const result = await cachedStatus(agentId, forceRefresh)

      return json(
        200,
        {
          state:
            result.value.agent.status === 'ONLINE'
              ? 'connected'
              : 'attention',
          ...result.value,
          fetchedAt: result.fetchedAt,
          cached: result.cached
        },
        { 'Cache-Control': 'no-store' }
      )
    } catch (error) {
      if (
        error instanceof DomotzApiError &&
        error.code === 'DOMOTZ_AGENT_NOT_FOUND'
      ) {
        return json(
          200,
          {
            state: 'link-invalid',
            fetchedAt: new Date().toISOString()
          },
          { 'Cache-Control': 'no-store' }
        )
      }

      return domotzError('status summary', error)
    }
  }
})

app.http('domotzUpsStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'domotz/ups/{clientId}',

  handler: async request => {
    const principal = getClientPrincipal(request)

    if (!principal) {
      return json(401, { error: 'Authentication required' })
    }

    if (!hasAnyRole(principal, allowedRoles)) {
      return json(403, {
        error: 'Administrator or engineer access is required'
      })
    }

    const clientId = String(request.params.clientId || '').trim()

    if (!clientId || clientId.length > 200) {
      return json(400, { error: 'Invalid Jetbuilt client ID' })
    }

    try {
      const clientSettings = await readClientSettings(clientId)
      const agentId =
        clientSettings.settings.integrations?.domotz?.agentId || ''

      if (!agentId) {
        return json(
          200,
          {
            state: 'not-linked',
            devices: [],
            fetchedAt: null
          },
          { 'Cache-Control': 'no-store' }
        )
      }

      const forceRefresh = request.query.get('refresh') === 'true'
      const result = await cachedUps(agentId, forceRefresh)

      return json(
        200,
        {
          state: upsState(result.value.devices),
          ...result.value,
          fetchedAt: result.fetchedAt,
          cached: result.cached,
          dataSource: 'domotz'
        },
        { 'Cache-Control': 'no-store' }
      )
    } catch (error) {
      if (
        error instanceof DomotzApiError &&
        error.code === 'DOMOTZ_AGENT_NOT_FOUND'
      ) {
        return json(
          200,
          {
            state: 'link-invalid',
            devices: [],
            fetchedAt: new Date().toISOString(),
            dataSource: 'domotz'
          },
          { 'Cache-Control': 'no-store' }
        )
      }

      return domotzError('UPS summary', error)
    }
  }
})

async function cachedAgents(forceRefresh) {
  const now = Date.now()

  if (
    !forceRefresh &&
    agentsCache &&
    agentsCache.expiresAt > now
  ) {
    return {
      value: agentsCache.value,
      fetchedAt: agentsCache.fetchedAt,
      cached: true
    }
  }

  const value = await listAgents()
  const fetchedAt = new Date().toISOString()

  agentsCache = {
    value,
    fetchedAt,
    expiresAt: now + cacheTtlMs()
  }

  return { value, fetchedAt, cached: false }
}

async function cachedStatus(agentId, forceRefresh) {
  const now = Date.now()
  const cached = statusCache.get(agentId)

  if (!forceRefresh && cached?.expiresAt > now) {
    return {
      value: cached.value,
      fetchedAt: cached.fetchedAt,
      cached: true
    }
  }

  const [agent, devices] = await Promise.all([
    getAgent(agentId),
    getDeviceStatusCounts(agentId)
  ])
  const fetchedAt = new Date().toISOString()
  const value = { agent, devices }

  statusCache.set(agentId, {
    value,
    fetchedAt,
    expiresAt: now + cacheTtlMs()
  })

  return { value, fetchedAt, cached: false }
}

async function cachedUps(agentId, forceRefresh) {
  const now = Date.now()
  const cached = upsCache.get(agentId)

  if (!forceRefresh && cached?.expiresAt > now) {
    return {
      value: cached.value,
      fetchedAt: cached.fetchedAt,
      cached: true
    }
  }

  if (!forceRefresh && upsRequests.has(agentId)) {
    const result = await upsRequests.get(agentId)
    return { ...result, cached: true }
  }

  const pending = (async () => {
    const value = await getUpsMonitoring(agentId)
    const fetchedAt = new Date().toISOString()

    upsCache.set(agentId, {
      value,
      fetchedAt,
      expiresAt: Date.now() + cacheTtlMs()
    })

    return { value, fetchedAt, cached: false }
  })()

  upsRequests.set(agentId, pending)

  try {
    return await pending
  } finally {
    if (upsRequests.get(agentId) === pending) {
      upsRequests.delete(agentId)
    }
  }
}

function upsState(devices) {
  if (!Array.isArray(devices) || devices.length === 0) {
    return 'no-devices'
  }

  const attention = devices.some(device =>
    device.status !== 'ONLINE' ||
    device.outputSource !== 'normal' ||
    (device.alarmsPresent !== null && device.alarmsPresent > 0) ||
    !['batterynormal', 'unknown'].includes(device.batteryStatus)
  )

  return attention ? 'attention' : 'connected'
}

function cacheTtlMs() {
  const configured = Number(process.env.DOMOTZ_CACHE_TTL_MS)

  if (!Number.isFinite(configured)) {
    return defaultCacheTtlMs
  }

  return Math.min(
    Math.max(Math.trunc(configured), 0),
    maximumCacheTtlMs
  )
}

function domotzError(context, error) {
  const code =
    error instanceof DomotzApiError
      ? error.code
      : 'DOMOTZ_UNEXPECTED_ERROR'
  const status =
    error instanceof DomotzApiError
      ? error.statusCode
      : 500

  console.error(`Domotz ${context} failed`, { code, status })

  return json(status, {
    error:
      error instanceof Error
        ? error.message
        : 'Unable to retrieve Domotz data',
    code
  })
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
