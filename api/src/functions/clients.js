const { app } = require('@azure/functions')
const { getClientPrincipal } = require('../auth/clientPrincipal')
const {
  filterAccessibleClients,
  hasWatchkeeperAccess
} = require('../auth/clientAccess')

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

    if (!hasWatchkeeperAccess(principal)) {
      return json(403, {
        error: 'Watchkeeper access is required'
      })
    }

    try {
      const forceRefresh =
        request.query.get('refresh') === 'true'

      const result = await getClients(forceRefresh)
      const clients = filterAccessibleClients(
        principal,
        result.clients,
        process.env.WATCHKEEPER_OPERATOR_CLIENT_ACCESS
      )

      return json(
        200,
        {
          clients,
          count: clients.length,
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

  const projectsPath =
    process.env.JETBUILT_PROJECTS_PATH ||
    'projects'

  if (!apiKey) {
    throw new Error('JETBUILT_API_KEY is not configured')
  }

  const [rawClients, rawProjects] = await Promise.all([
    fetchPaginatedCollection({
      firstUrl: buildApiUrl(baseUrl, clientsPath),
      apiKey,
      collectionName: 'clients',
      extractItems: extractClientArray
    }),
    fetchPaginatedCollection({
      firstUrl: buildApiUrl(baseUrl, projectsPath),
      apiKey,
      collectionName: 'projects',
      extractItems: extractProjectArray
    })
  ])

  const projectClientIds = new Set(
    rawProjects
      .map(getProjectClientId)
      .filter(clientId => clientId !== null)
  )

  return rawClients
    .map(normaliseClient)
    .filter(client => client !== null)
    .map(client => ({
      ...client,
      hasProjects: projectClientIds.has(client.id)
    }))
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

async function fetchPaginatedCollection({
  firstUrl,
  apiKey,
  collectionName,
  extractItems
}) {
  const firstPage = await fetchCollectionPage({
    url: firstUrl,
    apiKey,
    collectionName,
    extractItems
  })

  const items = [...firstPage.items]
  const totalCount = Number(firstPage.totalCount)
  const nextUrl = getNextPageUrl(
    firstPage.linkHeader,
    firstUrl
  )

  if (
    nextUrl &&
    items.length > 0 &&
    Number.isFinite(totalCount) &&
    totalCount >= items.length
  ) {
    const totalPages = Math.ceil(totalCount / items.length)

    if (totalPages > 100) {
      throw new Error(
        `Jetbuilt ${collectionName} pagination exceeded 100 pages`
      )
    }

    const pageUrls = Array.from(
      { length: Math.max(totalPages - 1, 0) },
      (_, index) => createPageUrl(nextUrl, index + 2)
    )

    const remainingPages = await mapWithConcurrency(
      pageUrls,
      10,
      url =>
        fetchCollectionPage({
          url,
          apiKey,
          collectionName,
          extractItems
        })
    )

    for (const page of remainingPages) {
      items.push(...page.items)
    }

    return items
  }

  let fallbackUrl = nextUrl
  let pageCount = 1

  while (fallbackUrl) {
    pageCount += 1

    if (pageCount > 100) {
      throw new Error(
        `Jetbuilt ${collectionName} pagination exceeded 100 pages`
      )
    }

    const page = await fetchCollectionPage({
      url: fallbackUrl,
      apiKey,
      collectionName,
      extractItems
    })

    items.push(...page.items)

    fallbackUrl = getNextPageUrl(
      page.linkHeader,
      fallbackUrl
    )
  }

  return items
}

async function fetchCollectionPage({
  url,
  apiKey,
  collectionName,
  extractItems
}) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.jetbuilt.v1',
      Authorization: `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    const responseText = await response.text()

    console.error(
      `Jetbuilt ${collectionName} response`,
      response.status,
      responseText.slice(0, 1000)
    )

    throw new Error(
      `Jetbuilt returned HTTP ${response.status}`
    )
  }

  const payload = await response.json()

  return {
    items: extractItems(payload),
    linkHeader: response.headers.get('link'),
    totalCount: response.headers.get('x-total-count')
  }
}

function createPageUrl(templateUrl, pageNumber) {
  const url = new URL(templateUrl)
  url.searchParams.set('page', String(pageNumber))
  return url.toString()
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length)
  let nextIndex = 0

  async function work() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(values[currentIndex])
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      work
    )
  )

  return results
}

function buildApiUrl(baseUrl, path) {
  return new URL(
    path.replace(/^\/+/, ''),
    ensureTrailingSlash(baseUrl)
  ).toString()
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

function extractProjectArray(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.projects)) {
    return payload.projects
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  throw new Error(
    'Jetbuilt returned an unexpected projects response'
  )
}

function getProjectClientId(project) {
  if (!project || typeof project !== 'object') {
    return null
  }

  const clientId =
    project.client?.id ??
    project.client_id ??
    project.clientId

  return clientId === undefined || clientId === null
    ? null
    : String(clientId)
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
