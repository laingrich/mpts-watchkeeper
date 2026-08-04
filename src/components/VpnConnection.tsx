import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  normaliseClientSettings,
  type ClientSettingsResponse,
} from '../clientSettings'
import './VpnConnection.css'

type VpnState =
  | 'checking'
  | 'helper-unavailable'
  | 'unconfigured'
  | 'disconnected'
  | 'opening'
  | 'connected-local'
  | 'connected-teleport'

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
const WIFIMAN_IOS_URL =
  'https://apps.apple.com/app/ubiquiti-wifiman/id1385561119'
const WIFIMAN_ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.ubnt.usurvey'
const WIFIMAN_DESKTOP_URL =
  'https://ui.com/download/app/wifiman-desktop'

function getWiFimanUrl() {
  const userAgent = navigator.userAgent.toLowerCase()
  const isAppleTouchDevice =
    /iphone|ipad|ipod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1)

  if (isAppleTouchDevice) return WIFIMAN_IOS_URL
  if (userAgent.includes('android')) return WIFIMAN_ANDROID_URL
  return WIFIMAN_DESKTOP_URL
}

export default function VpnConnection({
  clientId,
  clientName,
}: VpnConnectionProps) {
  const [state, setState] =
    useState<VpnState>('checking')
  const [detail, setDetail] = useState(
    'Checking site access…',
  )
  const [isTeleportConfigured, setIsTeleportConfigured] =
    useState<boolean | null>(null)
  const retryTimers = useRef<number[]>([])
  const teleportLaunchRequested = useRef(false)

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
          'No local Teleport profile is configured for this client.',
        )
        return
      }

      if (status.connected) {
        const latency =
          status.latencyMs !== undefined
            ? ` (${status.latencyMs} ms)`
            : ''

        if (teleportLaunchRequested.current) {
          setState('connected-teleport')
          setDetail(
            `Site reachable through UniFi Teleport${latency}`,
          )
        } else {
          setState('connected-local')
          setDetail(
            `Site reachable directly from this computer${latency}`,
          )
        }
        return
      }

      setState('disconnected')
      setDetail(
        status.message ||
          'The client network is not reachable from this computer.',
      )
    } catch {
      setState('helper-unavailable')
      setDetail(
        `Open WiFiman and select ${clientName} in Teleport. Watchkeeper cannot verify the connection automatically on this device.`,
      )
    }
  }, [clientId, clientName])

  useEffect(() => {
    let cancelled = false

    async function loadAccessProvider() {
      try {
        const response = await fetch(
          `/api/client-settings/${encodeURIComponent(clientId)}`,
          {
            headers: {
              Accept: 'application/json',
            },
            cache: 'no-store',
          },
        )

        if (!response.ok) {
          throw new Error('Unable to load access provider')
        }

        const data =
          (await response.json()) as ClientSettingsResponse
        const settings = normaliseClientSettings(data.settings)

        if (!cancelled) {
          setIsTeleportConfigured(
            settings.access.provider === 'unifi-teleport',
          )
        }
      } catch {
        if (!cancelled) {
          setIsTeleportConfigured(false)
        }
      }
    }

    setIsTeleportConfigured(null)
    void loadAccessProvider()

    return () => {
      cancelled = true
    }
  }, [clientId])

  useEffect(() => {
    if (!isTeleportConfigured) {
      return
    }

    teleportLaunchRequested.current = false
    clearRetryTimers()
    setState('checking')
    setDetail('Checking site access…')
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
    isTeleportConfigured,
  ])

  async function openVpnApplication() {
    teleportLaunchRequested.current = true
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
    } catch {
      setState('helper-unavailable')
      setDetail(
        `Open WiFiman and select ${clientName} in Teleport. Watchkeeper cannot verify the connection automatically on this device.`,
      )
    }
  }

  if (isTeleportConfigured === null) {
    return (
      <StaticConnectionRow
        title="Access provider"
        detail="Loading site access configuration…"
        label="Checking…"
        dotClass="vpn-status-dot-checking"
      />
    )
  }

  if (!isTeleportConfigured) {
    return (
      <StaticConnectionRow
        title="Not configured"
        detail="Choose an access provider in Site configuration."
        label="Not configured"
        dotClass="hero-status-dot-muted"
      />
    )
  }

  const isConnected =
    state === 'connected-local' ||
    state === 'connected-teleport'

  const dotClass = [
    'status-dot',
    isConnected
      ? ''
      : state === 'opening' ||
        state === 'checking'
      ? 'vpn-status-dot-checking'
      : 'hero-status-dot-muted',
  ]
    .filter(Boolean)
    .join(' ')

  const label =
    state === 'connected-local'
      ? 'On site'
      : state === 'connected-teleport'
      ? 'Connected'
      : state === 'opening'
      ? 'Opening…'
      : state === 'checking'
      ? 'Checking…'
      : state === 'unconfigured'
      ? 'Profile missing'
      : state === 'helper-unavailable'
      ? 'Connection status unavailable'
      : 'Disconnected'

  const disabled =
    state === 'checking' ||
    state === 'opening' ||
    state === 'unconfigured' ||
    state === 'connected-local'

  return (
    <div className="hero-connection-row">
      <span className={dotClass} />

      <div className="hero-connection-copy">
        <strong>UniFi Teleport</strong>
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

        {state === 'helper-unavailable' ? (
          <a
            className="hero-vpn-button"
            href={getWiFimanUrl()}
            target="_blank"
            rel="noreferrer"
            title={`Get or open WiFiman, then choose ${clientName} under Teleport`}
          >
            Get/Open WiFiman
          </a>
        ) : (
          <button
            className="hero-vpn-button"
            type="button"
            disabled={disabled}
            onClick={() => void openVpnApplication()}
          >
            {state === 'connected-local'
              ? 'Connected locally'
              : state === 'connected-teleport'
              ? 'Open WiFiman'
              : 'Connect to site'}
          </button>
        )}
      </div>
    </div>
  )
}

type StaticConnectionRowProps = {
  title: string
  detail: string
  label: string
  dotClass: string
}

function StaticConnectionRow({
  title,
  detail,
  label,
  dotClass,
}: StaticConnectionRowProps) {
  return (
    <div className="hero-connection-row">
      <span className={`status-dot ${dotClass}`} />

      <div className="hero-connection-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>

      <span className="hero-connection-label">
        {label}
      </span>
    </div>
  )
}
