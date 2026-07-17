const { app } = require('@azure/functions')
const {
  getClientPrincipal,
  hasAnyRole
} = require('../auth/clientPrincipal')

const allowedRoles = [
  'watchkeeper_admin',
  'watchkeeper_engineer'
]

let clientCache = {
  expiresAt: 0,
  clients: [],
  fetchedAt: null
}

app.http('clients', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'clients',

  handler: async request => {
    const principal = getClientPrincipal(request)

    if (!principal) {
      return json(401, {
        error: 'Authentication required'
      })
    }

    if (!hasAnyRole(principal, allowedRoles)) {
      return json(403, {
        error: 'Administrator or engineer access is required'
      })
    }

    try {
      const forceRefresh =
        request.query.get('refresh') === 'true'

      const result = await getClients(forceRefresh)

      return json(
        200,
        {
          clients: result.clients,
          count: result.clients.length,
          fetchedAt: result.fetchedAt,
          cached: result.cached,
          source: 'jetbuilt'
        },
        {
          'Cache-Control': 'no-store'
        }
      )
    } catch (error) {
      console.error('Jetbuilt client request failed', error)

      return json(502, {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to retrieve Jetbuilt clients'
      })
    }
  }
})

async function getClients(forceRefresh) {
  const now = Date.now()

  if (
    !forceRefresh &&
    clientCache.clients.length > 0 &&
    clientCache.expiresAt > now
  ) {
    return {
      clients: clientCache.clients,
      fetchedAt: clientCache.fetchedAt,
      cached: true
    }
  }

  const clients = await fetchAllClients()
  const fetchedAt = new Date().toISOString()
  const cacheTtl = readCacheTtl()

  clientCache = {
    clients,
    fetchedAt,
    expiresAt: now + cacheTtl
  }

  return {
    clients,
    fetchedAt,
    cached: false
  }
}

async function fetchAllClients() {
  const apiKey = process.env.JETBUILT_API_KEY
  const baseUrl =
    process.env.JETBUILT_BASE_URL ||
    'https://app.jetbuilt.com/api'

  const clientsPath =
    process.env.JETBUILT_CLIENTS_PATH ||
    'clients'

  if (!apiKey) {
    throw new Error('JETBUILT_API_KEY is not configured')
  }

  const cleanClientsPath =
    clientsPath.replace(/^\/+/, '')

  let nextUrl = new URL(
    cleanClientsPath,
    ensureTrailingSlash(baseUrl)
  ).toString()

  const rawClients = []
  let pageCount = 0

  while (nextUrl) {
    pageCount += 1

    if (pageCount > 100) {
      throw new Error(
        'Jetbuilt pagination exceeded 100 pages'
      )
    }

    const response = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.jetbuilt.v1',
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      const responseText = await response.text()

      console.error(
        'Jetbuilt response',
        response.status,
        responseText.slice(0, 1000)
      )

      throw new Error(
        `Jetbuilt returned HTTP ${response.status}`
      )
    }

    const payload = await response.json()
    const pageClients = extractClientArray(payload)

    rawClients.push(...pageClients)

    nextUrl = getNextPageUrl(
      response.headers.get('link'),
      nextUrl
    )
  }

  return rawClients
    .map(normaliseClient)
    .filter(client => client !== null)
    .sort((left, right) =>
      left.name.localeCompare(
        right.name,
        'en-GB',
        {
          sensitivity: 'base'
        }
      )
    )
}

function extractClientArray(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.clients)) {
    return payload.clients
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  throw new Error(
    'Jetbuilt returned an unexpected clients response'
  )
}

function normaliseClient(client) {
  if (!client || typeof client !== 'object') {
    return null
  }

  const id =
    client.id ??
    client.client_id ??
    client.uuid

  const name =
    client.name ??
    client.company_name ??
    client.client_name ??
    client.display_name

  if (id === undefined || id === null || !name) {
    console.warn(
      'Skipping Jetbuilt client with missing ID or name',
      client
    )

    return null
  }

  return {
    id: String(id),
    name: String(name).trim(),
    active:
      typeof client.active === 'boolean'
        ? client.active
        : null,
    updatedAt:
      client.updated_at ??
      client.updatedAt ??
      null
  }
}

function getNextPageUrl(linkHeader, currentUrl) {
  if (!linkHeader) {
    return null
  }

  const links = linkHeader.split(',')

  for (const link of links) {
    const match = link.match(
      /<([^>]+)>\s*;\s*rel="?next"?/i
    )

    if (match) {
      return new URL(match[1], currentUrl).toString()
    }
  }

  return null
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`
}

function readCacheTtl() {
  const parsed = Number(
    process.env.JETBUILT_CACHE_TTL_MS ||
    300000
  )

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : 300000
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
