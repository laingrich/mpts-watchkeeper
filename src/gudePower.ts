export type GudeAction = 'on' | 'off' | 'reset'

export type GudePort = {
  id: string
  number: number
  name: string
  state: 'on' | 'off' | 'unknown'
  canWrite: boolean
}

export type GudeStatus = {
  deviceId: string
  model: string
  ports: GudePort[]
  checkedAt: string
  dataSource: 'domotz'
}

export async function loadGudeStatus(
  clientId: string,
  deviceId: string,
) {
  const response = await fetch(endpoint(clientId, deviceId), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(await readError(response))
  return (await response.json()) as GudeStatus
}

export async function operateGudePort(
  clientId: string,
  deviceId: string,
  port: number,
  action: GudeAction,
) {
  const response = await fetch(endpoint(clientId, deviceId), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ port, action }),
  })
  if (!response.ok) throw new Error(await readError(response))
}

function endpoint(clientId: string, deviceId: string) {
  return `/api/gude-power/${encodeURIComponent(clientId)}/${encodeURIComponent(deviceId)}`
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string }
    return body.error || `Power request failed (${response.status})`
  } catch {
    return `Power request failed (${response.status})`
  }
}
