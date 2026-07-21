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

type SystemRowProps = {
  name: string
  purpose: string
  state: IntegrationState
  stateLabel: string
  summary: string
  detail: string
}

export default function IntegrationDashboard({
  clientName,
  monitoring,
  discovery,
  mode = 'overview',
}: IntegrationDashboardProps) {
  const domotzConfigured = monitoring.enabled && monitoring.domotzEnabled
  const unifiConfigured = discovery.enabled && discovery.method === 'unifi'

  const systems = [
    {
      name: 'Domotz',
      purpose: 'Monitoring',
      state: domotzConfigured ? 'configured' : 'not-configured',
      stateLabel: domotzConfigured ? 'Configured' : 'Not configured',
      summary: domotzConfigured
        ? 'Selected as the monitoring source; live Collector, device and alert data still needs the API connection.'
        : 'No Domotz monitoring source is configured for this site.',
      detail: domotzConfigured
        ? 'A future Domotz API connection will show the Collector state, important offline devices and active alert summaries here. Detailed diagnosis and alert management will continue in Domotz.'
        : 'To prepare this site, an administrator will enable monitoring and select Domotz in Site configuration. Until that workflow is connected, Watchkeeper will show no invented monitoring values.',
    },
    {
      name: 'UniFi',
      purpose: 'Network',
      state: unifiConfigured ? 'configured' : 'not-configured',
      stateLabel: unifiConfigured ? 'Configured' : 'Not configured',
      summary: unifiConfigured
        ? 'Selected as the discovery source; switches, ports, clients and VLANs still need the API connection.'
        : 'No UniFi network discovery source is configured for this site.',
      detail: unifiConfigured
        ? 'A future UniFi API connection will provide a read-only network summary and planned-versus-observed documentation. Network changes and detailed investigation will continue in UniFi.'
        : 'To prepare this site, an administrator will enable discovery and select UniFi in Site configuration. Watchkeeper will then be ready to accept live network inventory when the API connector is added.',
    },
  ] as const

  const visibleSystems = systems.filter(system => {
    if (mode === 'monitoring') return system.purpose === 'Monitoring'
    if (mode === 'network') return system.purpose === 'Network'
    return true
  })

  return (
    <section className="panel integration-summary">
      <header className="integration-summary-header">
        <div>
          <p className="eyebrow">SITE SYSTEMS</p>
          <h3>Monitoring and network sources</h3>
          <p>
            Watchkeeper is the first point of contact for {clientName}; the
            specialist services remain authoritative for investigation and
            action.
          </p>
        </div>
        <span className="integration-scope-badge">Read-only summary</span>
      </header>

      <div className="integration-system-list">
        {visibleSystems.map(system => (
          <SystemRow key={system.name} {...system} />
        ))}
      </div>

      <footer className="integration-summary-footer">
        Live values will appear only after a source API is connected. No
        simulated device, alert or network readings are shown.
      </footer>
    </section>
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
            : `What happens next`}
        </summary>
        <p>{detail}</p>
      </details>
    </article>
  )
}
