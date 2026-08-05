import { useCallback, useEffect, useMemo, useState } from 'react'
import './GudePowerControl.css'

export type GudePort = {
  number: number
  name: string
  state: 'on' | 'off' | 'unknown'
  resetting: boolean
  protected: boolean
}

export type GudeStatus = {
  deviceId: string
  model: string
  ports: GudePort[]
  checkedAt: string
  dataSource?: 'live' | 'simulated' | 'snapshot'
}

type GudePowerControlProps = {
  clientId: string
  deviceId: string
  deviceTitle: string
  configuredModel: string
  canEditNames: boolean
}

export type GudeAction = 'on' | 'off' | 'reset'

const HELPER_URL = 'http://127.0.0.1:47832'

export default function GudePowerControl({
  clientId,
  deviceId,
  deviceTitle,
  configuredModel,
  canEditNames,
}: GudePowerControlProps) {
  const [status, setStatus] = useState<GudeStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activePort, setActivePort] = useState<number | null>(null)
  const [hideUnused, setHideUnused] = useState(false)
  const [editingPort, setEditingPort] = useState<number | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [renamingPort, setRenamingPort] = useState<number | null>(null)

  const unusedPortCount = useMemo(() => (
    status?.ports.filter(isUnusedPort).length ?? 0
  ), [status])

  const visiblePorts = useMemo(() => (
    status?.ports.filter(port => !hideUnused || !isUnusedPort(port)) ?? []
  ), [hideUnused, status])

  const dataSourceLabel = status?.dataSource === 'snapshot'
    ? 'GUDE snapshot'
    : status?.dataSource === 'simulated'
      ? 'Simulated preview'
      : 'Live GUDE data'

  const refreshStatus = useCallback(async () => {
    try {
      const token = await requestGudeAuthorisation(
        clientId,
        deviceId,
        'gude:operate',
      )
      const next = await helperRequest('/gude/status', {
        clientId,
        deviceId,
      }, token)
      setStatus(next)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Unable to read GUDE ports')
    } finally {
      setLoading(false)
    }
  }, [clientId, deviceId])

  useEffect(() => {
    let cancelled = false
    let intervalId: number | null = null

    async function refresh() {
      if (!cancelled) await refreshStatus()
    }

    void refreshStatus()
    intervalId = window.setInterval(() => void refresh(), 15_000)

    return () => {
      cancelled = true
      if (intervalId !== null) window.clearInterval(intervalId)
    }
  }, [refreshStatus])

  async function operate(port: GudePort, action: GudeAction) {
    const actionLabel = action === 'reset' ? 'reset' : `switch ${action}`
    const consequence = action === 'reset'
      ? 'Power will be interrupted and restored using the GUDE reset delay.'
      : action === 'off'
        ? 'Power will remain off until it is switched on again.'
        : 'Power will be switched on.'

    if (!window.confirm(
      `${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} ${deviceTitle} port ${port.number} (${port.name})?\n\n${consequence}`,
    )) return

    setActivePort(port.number)
    setError('')

    try {
      const token = await requestGudeAuthorisation(
        clientId,
        deviceId,
        'gude:operate',
      )
      const next = await helperRequest('/gude/action', {
        clientId,
        deviceId,
        port: port.number,
        action,
      }, token)
      setStatus(next)
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'GUDE action failed')
    } finally {
      setActivePort(null)
    }
  }

  function beginRename(port: GudePort) {
    setEditingPort(port.number)
    setNameDraft(port.name)
    setError('')
  }

  function cancelRename() {
    setEditingPort(null)
    setNameDraft('')
  }

  async function saveName(port: GudePort) {
    const name = nameDraft.trim()
    if (!name) {
      setError('A port name is required')
      return
    }
    if (new TextEncoder().encode(name).length > 15) {
      setError('GUDE port names are limited to 15 characters')
      return
    }
    if (name === port.name) {
      cancelRename()
      return
    }

    if (!window.confirm(
      `Rename ${deviceTitle} port ${port.number} from “${port.name}” to “${name}”?\n\nThis changes the name stored on the GUDE itself.`,
    )) return

    setRenamingPort(port.number)
    setError('')

    try {
      const token = await requestGudeAuthorisation(
        clientId,
        deviceId,
        'gude:rename',
      )

      const next = await helperRequest('/gude/rename', {
        clientId,
        deviceId,
        port: port.number,
        name,
      }, token)
      setStatus(next)
      cancelRename()
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Unable to rename the GUDE port')
    } finally {
      setRenamingPort(null)
    }
  }

  return (
    <div className="gude-control">
      <div className="gude-control-summary">
        <div>
          <strong>{status?.model || configuredModel}</strong>
          <span>
            {status
              ? `${dataSourceLabel} · ${status.ports.length} ports · checked ${new Date(status.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : loading
                ? 'Checking live port state…'
                : 'Live port state requires the local Watchkeeper helper'}
          </span>
        </div>
        {status && unusedPortCount > 0 && (
          <label className="gude-unused-filter">
            <input
              type="checkbox"
              checked={hideUnused}
              onChange={event => setHideUnused(event.target.checked)}
            />
            Hide unused ({unusedPortCount})
          </label>
        )}
      </div>

      {status && ['simulated', 'snapshot'].includes(status.dataSource || '') && (
        <p className="gude-preview-note" role="status">
          {status.dataSource === 'snapshot'
            ? 'Preview only — names and initial states were read from the GUDE over SNMP; switching and name changes remain simulated.'
            : 'Preview only — these port names and states are simulated, not read from the GUDE.'}
        </p>
      )}

      {error && <p className="gude-control-error" role="alert">{error}</p>}

      {status && (
        <div className="gude-port-list">
          {visiblePorts.map(port => {
            const busy = activePort === port.number || renamingPort === port.number
            const switchDisabled = busy || port.protected || port.resetting || port.state === 'unknown'
            const switchAction = port.state === 'on' ? 'off' : 'on'
            const editing = editingPort === port.number

            return (
              <div className="gude-port" key={port.number}>
                <div className="gude-port-number">{port.number}</div>
                <div className="gude-port-copy">
                  {editing ? (
                    <form
                      className="gude-port-name-form"
                      onSubmit={event => {
                        event.preventDefault()
                        void saveName(port)
                      }}
                    >
                      <label htmlFor={`gude-port-name-${deviceId}-${port.number}`}>
                        Port {port.number} name
                      </label>
                      <div>
                        <input
                          id={`gude-port-name-${deviceId}-${port.number}`}
                          value={nameDraft}
                          maxLength={15}
                          autoFocus
                          disabled={busy}
                          onChange={event => setNameDraft(event.target.value)}
                        />
                        <button type="submit" disabled={busy}>Save</button>
                        <button type="button" disabled={busy} onClick={cancelRename}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="gude-port-name-row">
                      <strong>{port.name}</strong>
                      {canEditNames && (
                        <button
                          type="button"
                          className="gude-port-edit"
                          aria-label={`Edit ${port.name}`}
                          title="Edit name on GUDE"
                          disabled={busy}
                          onClick={() => beginRename(port)}
                        >
                          <span aria-hidden="true">✎</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="gude-port-actions">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={port.state === 'on'}
                    aria-label={`${port.name}: switch ${switchAction}`}
                    title={port.resetting ? `${port.name} is resetting` : `Switch ${port.name} ${switchAction}`}
                    className={`gude-port-toggle ${port.state}`}
                    disabled={switchDisabled}
                    onClick={() => void operate(port, switchAction)}
                  >
                    <span className="gude-port-toggle-track" aria-hidden="true">
                      <span />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="gude-port-reset"
                    disabled={busy || port.protected || port.resetting || port.state !== 'on'}
                    onClick={() => void operate(port, 'reset')}
                  >
                    Reset
                  </button>
                </div>
                {port.protected && <small>Protected from remote switching</small>}
              </div>
            )
          })}
        </div>
      )}

      <p className="gude-control-note">
        Every command requires confirmation and is recorded by the local helper.
      </p>
    </div>
  )
}

function isUnusedPort(port: GudePort) {
  return port.name.trim().toLowerCase() === 'unused'
}

export async function helperRequest(
  path: string,
  body: Record<string, unknown>,
  bearerToken = '',
) {
  let response: Response
  try {
    response = await fetch(`${HELPER_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      cache: 'no-store',
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('The local Watchkeeper helper is not running or cannot reach this GUDE')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Watchkeeper helper returned ${response.status}`)
  return data as GudeStatus
}

async function apiRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Watchkeeper returned ${response.status}`)
  return data as Record<string, unknown>
}

export async function requestGudeAuthorisation(
  clientId: string,
  deviceId: string,
  permission: 'gude:operate' | 'gude:rename',
) {
  const authorisation = await apiRequest('/api/gude-authorisation', {
    clientId,
    deviceId,
    permission,
  }) as { token?: string }

  if (!authorisation.token) {
    throw new Error('Watchkeeper did not return a valid device authorisation')
  }
  return authorisation.token
}
