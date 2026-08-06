import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadGudeStatus,
  operateGudePort,
  type GudeAction,
  type GudePort,
  type GudeStatus,
} from '../gudePower'
import './GudePowerControl.css'

type GudePowerControlProps = {
  clientId: string
  deviceId: string
  deviceTitle: string
  configuredModel: string
}

export default function GudePowerControl({
  clientId,
  deviceId,
  deviceTitle,
  configuredModel,
}: GudePowerControlProps) {
  const [status, setStatus] = useState<GudeStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activePort, setActivePort] = useState<number | null>(null)
  const [hideUnused, setHideUnused] = useState(false)

  const unusedPortCount = useMemo(() => (
    status?.ports.filter(isUnusedPort).length ?? 0
  ), [status])

  const visiblePorts = useMemo(() => (
    status?.ports.filter(port => !hideUnused || !isUnusedPort(port)) ?? []
  ), [hideUnused, status])

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await loadGudeStatus(clientId, deviceId))
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Unable to read GUDE ports through Domotz')
    } finally {
      setLoading(false)
    }
  }, [clientId, deviceId])

  useEffect(() => {
    void refreshStatus()
    const intervalId = window.setInterval(() => void refreshStatus(), 15_000)
    return () => window.clearInterval(intervalId)
  }, [refreshStatus])

  async function operate(port: GudePort, action: GudeAction) {
    const actionLabel = action === 'reset' ? 'power cycle' : `switch ${action}`
    const consequence = action === 'reset'
      ? 'Power will be interrupted and restored using the GUDE cycle delay.'
      : action === 'off'
        ? 'Power will remain off until it is switched on again.'
        : 'Power will be switched on.'

    if (!window.confirm(
      `${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} ${deviceTitle} port ${port.number} (${port.name})?\n\n${consequence}`,
    )) return

    setActivePort(port.number)
    setError('')

    try {
      await operateGudePort(clientId, deviceId, port.number, action)
      await delay(action === 'reset' ? 2_000 : 750)
      await refreshStatus()
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'GUDE action failed')
    } finally {
      setActivePort(null)
    }
  }

  return (
    <div className="gude-control">
      <div className="gude-control-summary">
        <div>
          <strong>{status?.model || configuredModel}</strong>
          <span>
            {status
              ? `Live via Domotz · ${status.ports.length} ports · checked ${new Date(status.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : loading
                ? 'Checking live port state through Domotz…'
                : 'Live port state is currently unavailable from Domotz'}
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

      {error && <p className="gude-control-error" role="alert">{error}</p>}

      {status && (
        <div className="gude-port-list">
          {visiblePorts.map(port => {
            const busy = activePort === port.number
            const switchDisabled = busy || !port.canWrite || port.state === 'unknown'
            const switchAction = port.state === 'on' ? 'off' : 'on'

            return (
              <div className="gude-port" key={port.id}>
                <div className="gude-port-number">{port.number}</div>
                <div className="gude-port-copy">
                  <strong>{port.name}</strong>
                </div>
                <div className="gude-port-actions">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={port.state === 'on'}
                    aria-label={`${port.name}: switch ${switchAction}`}
                    title={`Switch ${port.name} ${switchAction}`}
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
                    disabled={busy || !port.canWrite || port.state !== 'on'}
                    onClick={() => void operate(port, 'reset')}
                  >
                    Reset
                  </button>
                </div>
                {!port.canWrite && <small>Domotz reports this outlet as read-only</small>}
              </div>
            )
          })}
        </div>
      )}

      <p className="gude-control-note">
        Every command requires confirmation and is recorded by Watchkeeper.
      </p>
    </div>
  )
}

function isUnusedPort(port: GudePort) {
  const name = port.name.trim().toLowerCase()
  return name === 'unused' || name === 'power port'
}

function delay(milliseconds: number) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds))
}
