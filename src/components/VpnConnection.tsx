import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import './VpnConnection.css'

type VpnState =
  | 'checking'
  | 'helper-unavailable'
  | 'unconfigured'
  | 'disconnected'
  | 'opening'
  | 'connected'

type StatusResponse = {
  configured?: boolean
  connected?: boolean
  status?: string
  message?: string
  httpStatus?: number
  latencyMs?: number
  checkedAt?: string
}

type VpnConnectionProps = {
  clientId: string
  clientName: string
}

const AGENT_URL = 'http://127.0.0.1:47831'

export default function VpnConnection({
  clientId,
  clientName,
}: VpnConnectionProps) {
  const [state, setState] =
    useState<VpnState>('checking')
  const [detail, setDetail] = useState(
    'Checking local VPN status…',
  )
  const retryTimers = useRef<number[]>([])

  const clearRetryTimers = useCallback(() => {
    retryTimers.current.forEach(timer =>
      window.clearTimeout(timer),
    )
    retryTimers.current = []
  }, [])

  const checkStatus = useCallback(async () => {
    const params = new URLSearchParams({
      clientId,
      clientName,
    })

    try {
      const response = await fetch(
        `${AGENT_URL}/vpn/status?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        },
      )

      if (!response.ok) {
        throw new Error(
          `VPN helper returned ${response.status}`,
        )
      }

      const status =
        (await response.json()) as StatusResponse

      if (!status.configured) {
        setState('unconfigured')
        setDetail(
          'No VPN profile is configured for this client.',
        )
        return
      }

      if (status.connected) {
        setState('connected')
        setDetail(
          status.latencyMs !== undefined
            ? `Client network reachable in ${status.latencyMs} ms`
            : 'Client network is reachable',
        )
        return
      }

      setState('disconnected')
      setDetail(
        status.message ||
          'Client network is not reachable',
      )
    } catch {
      setState('helper-unavailable')
      setDetail(
        'The local Watchkeeper VPN helper is not running.',
      )
    }
  }, [clientId, clientName])

  useEffect(() => {
    clearRetryTimers()
    setState('checking')
    setDetail('Checking local VPN status…')
    void checkStatus()

    const interval = window.setInterval(
      () => void checkStatus(),
      10_000,
    )

    return () => {
      window.clearInterval(interval)
      clearRetryTimers()
    }
  }, [
    checkStatus,
    clearRetryTimers,
  ])

  async function openVpnApplication() {
    setState('opening')
    setDetail(
      'Opening WiFiman. Complete the Teleport connection there.',
    )

    try {
      const response = await fetch(
        `${AGENT_URL}/vpn/open`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId,
            clientName,
          }),
        },
      )

      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as
          | { error?: string }
          | null

        throw new Error(
          body?.error ||
            `VPN helper returned ${response.status}`,
        )
      }

      clearRetryTimers()

      for (const delay of [2_000, 5_000, 10_000, 20_000]) {
        retryTimers.current.push(
          window.setTimeout(
            () => void checkStatus(),
            delay,
          ),
        )
      }
    } catch (error) {
      setState('helper-unavailable')
      setDetail(
        error instanceof Error
          ? error.message
          : 'Unable to open WiFiman',
      )
    }
  }

  const dotClass = [
    'status-dot',
    state === 'connected'
      ? ''
      : state === 'opening' ||
        state === 'checking'
      ? 'vpn-status-dot-checking'
      : state === 'helper-unavailable'
      ? 'vpn-status-dot-error'
      : 'hero-status-dot-muted',
  ]
    .filter(Boolean)
    .join(' ')

  const label =
    state === 'connected'
      ? 'Connected'
      : state === 'opening'
      ? 'Opening…'
      : state === 'checking'
      ? 'Checking…'
      : state === 'unconfigured'
      ? 'Not configured'
      : state === 'helper-unavailable'
      ? 'Helper offline'
      : 'Disconnected'

  const disabled =
    state === 'checking' ||
    state === 'opening' ||
    state === 'helper-unavailable' ||
    state === 'unconfigured'

  return (
    <div className="hero-connection-row">
      <span className={dotClass} />

      <div className="hero-connection-copy">
        <strong>Site VPN</strong>
        <small>{detail}</small>
      </div>

      <div className="vpn-connection-actions">
        <span
          className={[
            'vpn-status-label',
            state,
          ].join(' ')}
        >
          {label}
        </span>

        <button
          className="hero-vpn-button"
          type="button"
          disabled={disabled}
          onClick={() => void openVpnApplication()}
          title={
            state === 'helper-unavailable'
              ? 'Install or start the local Watchkeeper VPN helper'
              : undefined
          }
        >
          {state === 'connected'
            ? 'Open WiFiman'
            : 'Connect to site (VPN)'}
        </button>
      </div>
    </div>
  )
}
