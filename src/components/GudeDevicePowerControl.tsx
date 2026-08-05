import { useCallback, useEffect, useState } from 'react'
import {
  helperRequest,
  requestGudeAuthorisation,
  type GudeAction,
  type GudePort,
  type GudeStatus,
} from './GudePowerControl'
import './GudePowerControl.css'
import './GudeDevicePowerControl.css'

type GudeDevicePowerControlProps = {
  clientId: string
  deviceTitle: string
  gudeDeviceId: string
  gudeDeviceTitle: string
  portNumber: number
}

export default function GudeDevicePowerControl({
  clientId,
  deviceTitle,
  gudeDeviceId,
  gudeDeviceTitle,
  portNumber,
}: GudeDevicePowerControlProps) {
  const [status, setStatus] = useState<GudeStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const token = await requestGudeAuthorisation(
        clientId,
        gudeDeviceId,
        'gude:operate',
      )
      setStatus(await helperRequest('/gude/status', {
        clientId,
        deviceId: gudeDeviceId,
      }, token))
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Unable to read the GUDE power outlet')
    }
  }, [clientId, gudeDeviceId])

  useEffect(() => {
    void refresh()
    const intervalId = window.setInterval(() => void refresh(), 15_000)
    return () => window.clearInterval(intervalId)
  }, [refresh])

  const port = status?.ports.find(item => item.number === portNumber) ?? null

  async function operate(action: GudeAction) {
    if (!port) return
    const actionLabel = action === 'reset' ? 'power cycle' : `switch ${action}`
    if (!window.confirm(
      `${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} ${deviceTitle}?\n\n` +
      `This operates ${gudeDeviceTitle} port ${port.number} (${port.name}).`,
    )) return

    setBusy(true)
    setError('')
    try {
      const token = await requestGudeAuthorisation(
        clientId,
        gudeDeviceId,
        'gude:operate',
      )
      setStatus(await helperRequest('/gude/action', {
        clientId,
        deviceId: gudeDeviceId,
        port: port.number,
        action,
      }, token))
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'GUDE power action failed')
    } finally {
      setBusy(false)
    }
  }

  const switchAction = port?.state === 'on' ? 'off' : 'on'
  const switchDisabled = busy || !port || port.protected || port.resetting || port.state === 'unknown'

  return (
    <div className="gude-device-power">
      <div className="gude-device-power-copy">
        <p className="eyebrow">POWER VIA GUDE</p>
        <strong>{port?.name || `${gudeDeviceTitle} port ${portNumber}`}</strong>
        <span>{gudeDeviceTitle} · port {portNumber}</span>
      </div>

      <div className="gude-port-actions">
        <button
          type="button"
          role="switch"
          aria-checked={port?.state === 'on'}
          aria-label={`${deviceTitle}: switch ${switchAction}`}
          className={`gude-port-toggle ${port?.state || 'unknown'}`}
          disabled={switchDisabled}
          onClick={() => void operate(switchAction)}
        >
          <span className="gude-port-toggle-track" aria-hidden="true"><span /></span>
        </button>
        <button
          type="button"
          className="gude-port-reset"
          disabled={busy || !port || port.protected || port.resetting || port.state !== 'on'}
          onClick={() => void operate('reset')}
        >
          Reset
        </button>
      </div>

      {error && <p className="gude-control-error" role="alert">{error}</p>}
    </div>
  )
}
