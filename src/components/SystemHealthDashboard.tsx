import './SystemHealthDashboard.css'

type SystemHealthDashboardProps = {
  clientName: string
  configuredDeviceCount: number
  onOpenDevices: () => void
}

type HealthCheck = {
  name: string
  category: string
  value: string
  status: 'healthy' | 'warning' | 'critical'
  detail: string
}

const mockChecks: HealthCheck[] = [
  {
    name: 'Core network',
    category: 'Network',
    value: '18 ms',
    status: 'healthy',
    detail: 'Gateway, switches and controller responding',
  },
  {
    name: 'RTI processor',
    category: 'Control',
    value: '29 ms',
    status: 'healthy',
    detail: 'Processor responding to health probe',
  },
  {
    name: 'AV rack temperature',
    category: 'Environment',
    value: '43 °C',
    status: 'warning',
    detail: 'Above the proposed 40 °C advisory threshold',
  },
  {
    name: 'UPS battery',
    category: 'Power',
    value: '96%',
    status: 'healthy',
    detail: 'Online, no active power alarms',
  },
]

export default function SystemHealthDashboard({
  clientName,
  configuredDeviceCount,
  onOpenDevices,
}: SystemHealthDashboardProps) {
  const sampleDeviceTotal = configuredDeviceCount || 13
  const sampleDeviceOnline = Math.max(sampleDeviceTotal - 1, 0)

  return (
    <section className="panel system-health-card">
      <header className="system-health-header">
        <div>
          <p className="eyebrow">SYSTEM HEALTH</p>
          <h3>Monitoring overview</h3>
          <p>
            Example of the key operational information Watchkeeper will
            collect for {clientName}.
          </p>
        </div>

        <span className="system-health-mock-badge">
          Mock data — not live
        </span>
      </header>

      <div className="system-health-summary">
        <div className="system-health-overall warning">
          <span className="system-health-status-dot" />
          <div>
            <small>OVERALL STATUS</small>
            <strong>Attention required</strong>
            <span>1 advisory condition, no critical alarms</span>
          </div>
        </div>

        <div className="system-health-metrics">
          <article>
            <small>DEVICES REACHABLE</small>
            <strong>
              {sampleDeviceOnline}/{sampleDeviceTotal}
            </strong>
            <span>Example local or VPN health checks</span>
          </article>

          <article>
            <small>INTERNET UPLINK</small>
            <strong>Online</strong>
            <span>28 ms · 0.2% packet loss</span>
          </article>

          <article>
            <small>NETWORK UPTIME</small>
            <strong>14d 6h</strong>
            <span>No gateway restart detected</span>
          </article>

          <article>
            <small>ACTIVE ALERTS</small>
            <strong>1</strong>
            <span>0 critical · 1 warning</span>
          </article>
        </div>
      </div>

      <div className="system-health-checks">
        <div className="system-health-checks-heading">
          <div>
            <h4>Latest health checks</h4>
            <p>
              Proposed combined view of devices, network, power and
              environmental monitoring.
            </p>
          </div>

          <button type="button" onClick={onOpenDevices}>
            View devices
          </button>
        </div>

        <div className="system-health-table" role="table">
          <div className="system-health-table-row heading" role="row">
            <span role="columnheader">Check</span>
            <span role="columnheader">Category</span>
            <span role="columnheader">Reading</span>
            <span role="columnheader">Status</span>
          </div>

          {mockChecks.map(check => (
            <div
              className="system-health-table-row"
              role="row"
              key={check.name}
            >
              <span role="cell">
                <strong>{check.name}</strong>
                <small>{check.detail}</small>
              </span>
              <span role="cell">{check.category}</span>
              <span role="cell">{check.value}</span>
              <span role="cell">
                <span
                  className={`system-health-pill ${check.status}`}
                >
                  {check.status === 'healthy'
                    ? 'Healthy'
                    : check.status === 'warning'
                      ? 'Warning'
                      : 'Critical'}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <footer className="system-health-footer">
        Planned live sources include the local reachability helper,
        Domotz, UniFi, UPS/PDU telemetry and device-specific health checks.
      </footer>
    </section>
  )
}
