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
  const domotzConfigured = monitoring.source === 'domotz'
  const unifiConfigured = discovery.unifiEnabled

  const systems = [
    {
      name: 'Domotz',
      purpose: 'Monitoring',
      state: domotzConfigured ? 'configured' : 'not-configured',
      stateLabel: domotzConfigured ? 'Configured' : 'Not configured',
      summary: domotzConfigured
        ? 'Selected as the operational monitoring source; the live Collector, device and alert connection is still to be added.'
        : 'Domotz is not selected as the operational monitoring source for this site.',
      detail: domotzConfigured
        ? 'The next integration step will associate this client with its Domotz Agent. Watchkeeper will then show a read-only summary while alert rules, history and diagnosis remain in Domotz.'
        : 'In Site configuration, choose Domotz under Operational monitoring source. The selector records the intended authority now; a later connection step will associate the correct Domotz Agent.',
    },
    {
      name: 'UniFi',
      purpose: 'Network',
      state: unifiConfigured ? 'configured' : 'not-configured',
      stateLabel: unifiConfigured ? 'Configured' : 'Not configured',
      summary: unifiConfigured
        ? 'Enabled as a read-only network data source; switches, ports, clients and VLANs still need the API connection.'
        : 'UniFi network configuration is not enabled as an inventory source for this site.',
      detail: unifiConfigured
        ? 'The next integration step will associate the correct UniFi site and import a read-only network summary. Network changes and detailed investigation will continue in UniFi.'
        : 'In Site configuration, enable Use UniFi data under Inventory & Network. This prepares the site for a later controller association without claiming that live data is available.',
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
            : 'What happens next'}
        </summary>
        <p>{detail}</p>
      </details>
    </article>
  )
}
