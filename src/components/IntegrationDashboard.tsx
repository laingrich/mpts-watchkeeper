import type { ClientSettings } from '../clientSettings'
import './IntegrationDashboard.css'

type IntegrationDashboardProps = {
  clientName: string
  configuredDeviceCount: number
  monitoring: ClientSettings['monitoring']
  discovery: ClientSettings['discovery']
  mode?: 'overview' | 'monitoring' | 'network'
  onOpenDevices: () => void
}

type IntegrationState = 'connected' | 'configured' | 'not-configured'

type IntegrationCardProps = {
  eyebrow: string
  title: string
  state: IntegrationState
  stateLabel: string
  description: string
  metrics: Array<{ label: string; value: string }>
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export default function IntegrationDashboard({
  clientName,
  configuredDeviceCount,
  monitoring,
  discovery,
  mode = 'overview',
  onOpenDevices,
}: IntegrationDashboardProps) {
  const domotzConfigured = monitoring.enabled && monitoring.domotzEnabled
  const unifiConfigured = discovery.enabled && discovery.method === 'unifi'

  const heading =
    mode === 'monitoring'
      ? 'Monitoring'
      : mode === 'network'
        ? 'Network'
        : 'Site operations'

  const description =
    mode === 'monitoring'
      ? 'A first point of contact for monitoring status. Detailed investigation and alert management remain in Domotz.'
      : mode === 'network'
        ? 'A concise view of network inventory and configuration status. Detailed configuration remains in UniFi.'
        : 'Watchkeeper brings together status, site context and links to the specialist systems used to investigate and act.'

  return (
    <section className="integration-dashboard">
      <header className="integration-dashboard-header">
        <div>
          <p className="eyebrow">SINGLE PANE OF GLASS</p>
          <h3>{heading}</h3>
          <p>{description}</p>
        </div>

        <span className="integration-scope-badge">Read-only summary</span>
      </header>

      <div className="integration-principle">
        <strong>{clientName}</strong>
        <span>
          Watchkeeper summarises and links out; Domotz, UniFi, Jetbuilt and
          SharePoint remain the authoritative services.
        </span>
      </div>

      {(mode === 'overview' || mode === 'monitoring') && (
        <div className="integration-grid">
          <IntegrationCard
            eyebrow="MONITORING"
            title="Domotz"
            state={domotzConfigured ? 'configured' : 'not-configured'}
            stateLabel={domotzConfigured ? 'Configured' : 'Not configured'}
            description={
              domotzConfigured
                ? 'Domotz is selected as a monitoring source. Live API status and alerts are not connected yet.'
                : 'Enable Domotz for this site before Watchkeeper can show Collector, device and alert summaries.'
            }
            metrics={[
              {
                label: 'Collector',
                value: domotzConfigured ? 'Awaiting API' : 'Unavailable',
              },
              {
                label: 'Active alerts',
                value: domotzConfigured ? 'Awaiting API' : '—',
              },
              {
                label: 'Device state',
                value: domotzConfigured ? 'Awaiting API' : '—',
              },
            ]}
          />

          <IntegrationCard
            eyebrow="SITE INVENTORY"
            title="Watchkeeper devices"
            state="connected"
            stateLabel="Available"
            description="Site identity, purpose, launcher links and design information are held in Watchkeeper."
            metrics={[
              { label: 'Configured devices', value: String(configuredDeviceCount) },
              { label: 'Live reachability', value: 'Local helper / VPN' },
              { label: 'Monitoring source', value: domotzConfigured ? 'Domotz planned' : 'Not linked' },
            ]}
            actionLabel="View devices"
            onAction={onOpenDevices}
          />
        </div>
      )}

      {(mode === 'overview' || mode === 'network') && (
        <div className="integration-grid">
          <IntegrationCard
            eyebrow="NETWORK"
            title="UniFi"
            state={unifiConfigured ? 'configured' : 'not-configured'}
            stateLabel={unifiConfigured ? 'Configured' : 'Not configured'}
            description={
              unifiConfigured
                ? 'UniFi is selected for discovery. Live switches, ports, clients and VLAN data are not connected yet.'
                : 'Select UniFi discovery to prepare this site for network inventory and documentation synchronisation.'
            }
            metrics={[
              {
                label: 'Console',
                value: unifiConfigured ? 'Awaiting API' : 'Unavailable',
              },
              {
                label: 'Switches and APs',
                value: unifiConfigured ? 'Awaiting API' : '—',
              },
              {
                label: 'Configuration sync',
                value: unifiConfigured ? 'Not run' : '—',
              },
            ]}
          />

          <IntegrationCard
            eyebrow="DOCUMENTATION"
            title="Planned vs observed"
            state="configured"
            stateLabel="Design stage"
            description="Watchkeeper will retain planned devices, ports and VLANs, then compare them with the live UniFi inventory."
            metrics={[
              { label: 'Design records', value: 'Watchkeeper / import' },
              { label: 'Observed network', value: unifiConfigured ? 'UniFi planned' : 'Not linked' },
              { label: 'Discrepancies', value: 'Awaiting sync' },
            ]}
          />
        </div>
      )}

      <footer className="integration-dashboard-footer">
        No simulated operational readings are shown. Values marked “Awaiting API”
        will be replaced only when a source integration is returning live data.
      </footer>
    </section>
  )
}

function IntegrationCard({
  eyebrow,
  title,
  state,
  stateLabel,
  description,
  metrics,
  actionLabel,
  actionHref,
  onAction,
}: IntegrationCardProps) {
  return (
    <article className="panel integration-card">
      <header>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h4>{title}</h4>
        </div>
        <span className={`integration-state ${state}`}>{stateLabel}</span>
      </header>

      <p className="integration-card-description">{description}</p>

      <dl className="integration-metrics">
        {metrics.map(metric => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>

      {actionHref && actionLabel && (
        <a href={actionHref} target="_blank" rel="noreferrer">
          {actionLabel}
        </a>
      )}

      {onAction && actionLabel && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </article>
  )
}
