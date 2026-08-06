import { useEffect, useState } from 'react'
import type { ClientSettings } from '../clientSettings'
import {
  loadDomotzStatus,
  type DomotzStatus,
} from '../domotz'
import './IntegrationDashboard.css'

type IntegrationDashboardProps = {
  clientId: string
  clientName: string
  monitoring: ClientSettings['monitoring']
  integrations: ClientSettings['integrations']
  discovery: ClientSettings['discovery']
  mode?: 'overview' | 'monitoring' | 'network'
  onConfigureMonitoring?: () => void
}

type IntegrationState =
  | 'connected'
  | 'attention'
  | 'configured'
  | 'not-configured'

type DomotzPresentation = {
  state: IntegrationState
  stateLabel: string
  headline: string
  summary: string
  nextAction: string
  showMetrics: boolean
  requiresConfiguration: boolean
}

type SystemRowProps = {
  name: string
  purpose: string
  state: IntegrationState
  stateLabel: string
  summary: string
  detail: string
}

const DOMOTZ_PORTAL_URL = 'https://portal.domotz.com/webapp/explorer'

export default function IntegrationDashboard({
  clientId,
  clientName,
  monitoring,
  integrations,
  discovery,
  mode = 'overview',
  onConfigureMonitoring,
}: IntegrationDashboardProps) {
  const domotzConfigured = monitoring.source === 'domotz'
  const unifiConfigured = discovery.unifiEnabled
  const domotzAgentId = integrations.domotz.agentId
  const [domotzStatus, setDomotzStatus] =
    useState<DomotzStatus | null>(null)
  const [domotzError, setDomotzError] = useState<string | null>(null)
  const [isDomotzLoading, setIsDomotzLoading] = useState(false)
  const [refreshRequest, setRefreshRequest] = useState(0)

  useEffect(() => {
    let active = true

    if (!domotzConfigured || !domotzAgentId) {
      setDomotzStatus(null)
      setDomotzError(null)
      setIsDomotzLoading(false)
      return () => {
        active = false
      }
    }

    setDomotzError(null)
    setIsDomotzLoading(true)

    void loadDomotzStatus(clientId, refreshRequest > 0)
      .then(status => {
        if (active) setDomotzStatus(status)
      })
      .catch(error => {
        if (active) {
          setDomotzError(
            error instanceof Error
              ? error.message
              : 'Unable to retrieve Domotz status',
          )
        }
      })
      .finally(() => {
        if (active) setIsDomotzLoading(false)
      })

    return () => {
      active = false
    }
  }, [clientId, domotzAgentId, domotzConfigured, refreshRequest])

  const domotzPresentation = describeDomotz({
    configured: domotzConfigured,
    agentId: domotzAgentId,
    status: domotzStatus,
    error: domotzError,
    isLoading: isDomotzLoading,
  })

  const unifiSystem = {
    name: 'UniFi',
    purpose: 'Network source',
    state: unifiConfigured ? 'configured' : 'not-configured',
    stateLabel: unifiConfigured ? 'Configured' : 'Not configured',
    summary: unifiConfigured
      ? 'Enabled as a read-only network data source; switches, ports, clients and VLANs still need the API connection.'
      : 'UniFi network configuration is not enabled as an inventory source for this site.',
    detail: unifiConfigured
      ? 'The next integration step will associate the correct UniFi site and import a read-only network summary. Network changes and detailed investigation will continue in UniFi.'
      : 'In Site configuration, enable Use UniFi data under Inventory & Network. This prepares the site for a later controller association without claiming that live data is available.',
  } satisfies SystemRowProps

  return (
    <section className="panel integration-summary">
      <header className="integration-summary-header">
        <div>
          <p className="eyebrow">SITE MONITORING</p>
          <h3>Current availability</h3>
          <p>
            Watchkeeper shows the support summary for {clientName}. Domotz
            remains authoritative for detailed alerts, history and diagnosis.
          </p>
        </div>
        <span className="integration-scope-badge">Read-only summary</span>
      </header>

      {mode !== 'network' && (
        <DomotzMonitoringPanel
          presentation={domotzPresentation}
          status={domotzStatus}
          isLoading={isDomotzLoading}
          canRefresh={domotzConfigured && Boolean(domotzAgentId)}
          onRefresh={() => setRefreshRequest(current => current + 1)}
          onConfigure={onConfigureMonitoring}
        />
      )}

      {mode !== 'monitoring' && <SystemRow {...unifiSystem} />}

      <footer className="integration-summary-footer">
        Values are retrieved from connected source APIs. Watchkeeper does not
        generate simulated device, alert or network readings.
      </footer>
    </section>
  )
}

function DomotzMonitoringPanel({
  presentation,
  status,
  isLoading,
  canRefresh,
  onRefresh,
  onConfigure,
}: {
  presentation: DomotzPresentation
  status: DomotzStatus | null
  isLoading: boolean
  canRefresh: boolean
  onRefresh: () => void
  onConfigure?: () => void
}) {
  const devices = status?.devices
  const unavailable = devices
    ? devices.importantOffline + devices.importantDown
    : 0

  return (
    <article className={`domotz-monitoring-card ${presentation.state}`}>
      <header className="domotz-monitoring-header">
        <div className="domotz-monitoring-title">
          <span
            className={`integration-system-dot ${presentation.state}`}
            aria-hidden="true"
          />
          <div>
            <small>Domotz monitoring</small>
            <h4>{presentation.headline}</h4>
          </div>
        </div>

        <div className="domotz-monitoring-actions">
          <span className={`integration-state ${presentation.state}`}>
            {presentation.stateLabel}
          </span>
          {canRefresh && (
            <button
              type="button"
              className="domotz-refresh-button"
              disabled={isLoading}
              onClick={onRefresh}
            >
              {isLoading ? 'Checking…' : 'Refresh'}
            </button>
          )}
          <a href={DOMOTZ_PORTAL_URL} target="_blank" rel="noreferrer">
            Open Domotz ↗
          </a>
        </div>
      </header>

      {presentation.showMetrics && devices ? (
        <div className="domotz-metric-grid" aria-label="Domotz device summary">
          <DomotzMetric
            label="Important devices"
            value={devices.importantTotal}
          />
          <DomotzMetric
            label="Online"
            value={devices.importantOnline}
            tone="connected"
          />
          <DomotzMetric
            label="Offline or down"
            value={unavailable}
            tone={unavailable > 0 ? 'attention' : 'neutral'}
          />
          <DomotzMetric
            label="Other discovered"
            value={devices.otherVisible}
            tone="neutral"
          />
        </div>
      ) : (
        <div className="domotz-monitoring-empty">
          <strong>{presentation.summary}</strong>
          <p>{presentation.nextAction}</p>
          {onConfigure && presentation.requiresConfiguration && (
            <button type="button" onClick={onConfigure}>
              Configure monitoring
            </button>
          )}
        </div>
      )}

      {presentation.showMetrics && (
        <div className="domotz-monitoring-context">
          <div>
            <strong>{presentation.summary}</strong>
            <p>{presentation.nextAction}</p>
          </div>
          <div className="domotz-monitoring-timestamps">
            {status?.agent?.lastChange && (
              <span>
                Collector state changed {formatDate(status.agent.lastChange)}
              </span>
            )}
            {status?.fetchedAt && (
              <span>
                Updated {formatDate(status.fetchedAt)}
                {status.cached ? ' · cached' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function DomotzMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'connected' | 'attention' | 'configured' | 'neutral'
}) {
  return (
    <div className={`domotz-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString('en-GB')}</strong>
    </div>
  )
}

function SystemRow({
  name,
  purpose,
  state,
  stateLabel,
  summary,
  detail,
}: SystemRowProps) {
  return (
    <article className="integration-system-row">
      <div className="integration-system-identity">
        <span className={`integration-system-dot ${state}`} />
        <div>
          <small>{purpose}</small>
          <strong>{name}</strong>
        </div>
      </div>

      <p>{summary}</p>

      <span className={`integration-state ${state}`}>{stateLabel}</span>

      <details className="integration-guidance">
        <summary>
          {state === 'not-configured'
            ? `How to configure ${name}`
            : 'What happens next'}
        </summary>
        <p>{detail}</p>
      </details>
    </article>
  )
}

function describeDomotz({
  configured,
  agentId,
  status,
  error,
  isLoading,
}: {
  configured: boolean
  agentId: string
  status: DomotzStatus | null
  error: string | null
  isLoading: boolean
}): DomotzPresentation {
  if (!configured) {
    return {
      state: 'not-configured',
      stateLabel: 'Not configured',
      headline: 'Domotz is not connected to this client',
      summary: 'No operational monitoring source is selected.',
      nextAction:
        'Choose Domotz and associate the correct Collector in Site configuration.',
      showMetrics: false,
      requiresConfiguration: true,
    }
  }

  if (!agentId) {
    return {
      state: 'configured',
      stateLabel: 'Collector required',
      headline: 'Select the client’s Collector',
      summary: 'Domotz is selected, but no Collector is associated.',
      nextAction:
        'Choose the correct Collector in Site configuration. Watchkeeper stores only its external identifier.',
      showMetrics: false,
      requiresConfiguration: true,
    }
  }

  if (isLoading && !status) {
    return {
      state: 'configured',
      stateLabel: 'Checking',
      headline: 'Retrieving current availability',
      summary: 'Watchkeeper is requesting a read-only summary from Domotz.',
      nextAction: 'This normally takes only a few seconds.',
      showMetrics: false,
      requiresConfiguration: false,
    }
  }

  if (error) {
    return {
      state: 'configured',
      stateLabel: 'API unavailable',
      headline: 'Live Domotz status is unavailable',
      summary: error,
      nextAction:
        'The Collector association is retained. Retry after checking the server-side Domotz connection.',
      showMetrics: false,
      requiresConfiguration: false,
    }
  }

  if (status?.state === 'link-invalid') {
    return {
      state: 'attention',
      stateLabel: 'Relink required',
      headline: 'The linked Collector was not found',
      summary: 'Watchkeeper cannot match this client to a current Collector.',
      nextAction:
        'Select the existing Collector again in Site configuration; do not create a duplicate site record.',
      showMetrics: false,
      requiresConfiguration: true,
    }
  }

  if (status?.state === 'not-linked') {
    return {
      state: 'configured',
      stateLabel: 'Collector required',
      headline: 'Select the client’s Collector',
      summary: 'Domotz is selected, but no current Collector link was found.',
      nextAction:
        'Choose the correct Collector in Site configuration before relying on monitoring status.',
      showMetrics: false,
      requiresConfiguration: true,
    }
  }

  if (status?.agent && status.devices) {
    const devices = status.devices
    const unavailable =
      devices.importantOffline + devices.importantDown
    const collectorOnline = status.agent.status === 'ONLINE'
    const hasUnknownStatus = devices.importantUnknown > 0
    const hasNoImportantDevices = devices.importantTotal === 0
    const state: IntegrationState = !collectorOnline || unavailable > 0
      ? 'attention'
      : hasUnknownStatus || hasNoImportantDevices
        ? 'configured'
        : 'connected'

    return {
      state,
      stateLabel: !collectorOnline
        ? `Collector ${status.agent.status.toLocaleLowerCase('en-GB')}`
        : unavailable > 0
          ? `${unavailable} need attention`
          : hasNoImportantDevices
            ? 'No important devices'
          : hasUnknownStatus
            ? 'Status incomplete'
            : 'All online',
      headline: status.agent.name,
      summary: deviceSummary(status),
      nextAction: !collectorOnline
        ? 'Open Domotz to investigate the Collector before relying on device status.'
        : unavailable > 0
          ? `Review ${pluralise(unavailable, 'unavailable important device')} in Domotz.`
          : hasNoImportantDevices
            ? 'Mark the devices that matter to service availability as Important in Domotz.'
          : hasUnknownStatus
            ? `Review ${pluralise(devices.importantUnknown, 'important device with unknown status')} in Domotz.`
            : 'No immediate monitoring action is required.',
      showMetrics: true,
      requiresConfiguration: false,
    }
  }

  return {
    state: 'configured',
    stateLabel: 'Status unavailable',
    headline: 'No current monitoring summary',
    summary: 'The Collector is linked, but no current summary is available.',
    nextAction:
      'Keep the association in place and retry after checking the server-side Domotz connection.',
    showMetrics: false,
    requiresConfiguration: false,
  }
}

function deviceSummary(status: DomotzStatus) {
  const devices = status.devices!
  const unavailable =
    devices.importantOffline + devices.importantDown
  const parts = [
    `${devices.importantOnline} of ${devices.importantTotal} important devices are online`,
  ]

  if (unavailable > 0) {
    parts.push(`${unavailable} offline or down`)
  }

  if (devices.importantUnknown > 0) {
    parts.push(`${devices.importantUnknown} with unknown status`)
  }

  parts.push(
    `${devices.visibleTotal} total discovered in Domotz`,
  )

  return `${parts.join(' · ')}.`
}

function pluralise(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-GB')
}
