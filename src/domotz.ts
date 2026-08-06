export type DomotzAgent = {
  id: string
  name: string
  status: string
  lastChange: string | null
  apiEnabled: boolean
}

export type DomotzStatus = {
  state: 'not-linked' | 'connected' | 'attention' | 'link-invalid'
  agent?: DomotzAgent & {
    timezone: string
    organization: string
  }
  devices?: {
    visibleTotal: number
    importantTotal: number
    importantOnline: number
    importantOffline: number
    importantDown: number
    importantUnknown: number
    otherVisible: number
  }
  fetchedAt: string | null
  cached?: boolean
}

type DomotzAgentsResponse = {
  agents?: unknown
}

export async function loadDomotzAgents(forceRefresh = false) {
  const endpoint = forceRefresh
    ? '/api/domotz/agents?refresh=true'
    : '/api/domotz/agents'
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  const data = (await response.json()) as DomotzAgentsResponse

  if (!Array.isArray(data.agents)) {
    throw new Error('Domotz returned an invalid Collector list')
  }

  return data.agents.filter(isDomotzAgent)
}

export async function loadDomotzStatus(
  clientId: string,
  forceRefresh = false,
) {
  const suffix = forceRefresh ? '?refresh=true' : ''
  const response = await fetch(
    `/api/domotz/status/${encodeURIComponent(clientId)}${suffix}`,
    {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  return (await response.json()) as DomotzStatus
}

function isDomotzAgent(value: unknown): value is DomotzAgent {
  if (!value || typeof value !== 'object') {
    return false
  }

  const agent = value as Partial<DomotzAgent>

  return (
    typeof agent.id === 'string' &&
    typeof agent.name === 'string' &&
    typeof agent.status === 'string' &&
    (typeof agent.lastChange === 'string' ||
      agent.lastChange === null) &&
    typeof agent.apiEnabled === 'boolean'
  )
}

async function readApiError(response: Response) {
  try {
    const data = (await response.json()) as { error?: unknown }

    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error
    }
  } catch {
    // Use the stable fallback below.
  }

  return `Request failed with status ${response.status}`
}
