import { useMemo, useState, type CSSProperties } from 'react'
import saltmarshLauncher from '../data/saltmarsh-device-launcher.json'
import './DeviceLauncher.css'

type DetailCell = string | number | string[]
type DetailRow = DetailCell[]

type DeviceDetails = {
  type: string
  title: string
  rows: DetailRow[]
}

type LauncherDevice = {
  id: string
  title: string
  link: string
  group: string
  details?: DeviceDetails
}

type LauncherGroup = {
  id: string
  title: string
  accent: string
}

type LauncherConfig = {
  version: number
  groups: LauncherGroup[]
  devices: LauncherDevice[]
}

type DeviceLauncherProps = {
  siteId: string
  siteName: string
}

const launcherBySite: Record<string, LauncherConfig> = {}

const launcherByClientName: Record<string, LauncherConfig> = {
  'saltmarsh house': saltmarshLauncher as LauncherConfig,
}

function resolveLauncher(
  clientId: string,
  clientName = '',
) {
  return (
    launcherBySite[clientId] ??
    launcherByClientName[clientName.trim().toLowerCase()]
  )
}

export function getLauncherDeviceCount(
  clientId: string,
  fallback: number,
  clientName = '',
) {
  return (
    resolveLauncher(clientId, clientName)?.devices.length ??
    fallback
  )
}

function renderCell(cell: DetailCell) {
  if (Array.isArray(cell)) {
    return (
      <ul className="launcher-cell-list">
        {cell.map(item => <li key={item}>{item}</li>)}
      </ul>
    )
  }

  return cell || '—'
}

function DetailTable({ details }: { details: DeviceDetails }) {
  return (
    <div className="launcher-table-wrap">
      <table className="launcher-table">
        <tbody>
          {details.rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.map(String).join('-')}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>
                  {renderCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DeviceLauncher({
  siteId,
  siteName,
}: DeviceLauncherProps) {
  const config = resolveLauncher(siteId, siteName)
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [selectedDevice, setSelectedDevice] = useState<LauncherDevice | null>(null)
  const [showAllMaps, setShowAllMaps] = useState(false)

  const visibleGroups = useMemo(() => {
    if (!config) return []

    const normalized = query.trim().toLowerCase()

    return config.groups
      .map(group => {
        const devices = config.devices.filter(device => {
          if (device.group !== group.id) return false
          if (!normalized) return true

          const detailsText = device.details?.rows.flat(2).join(' ') ?? ''
          return `${device.title} ${device.link} ${group.title} ${detailsText}`
            .toLowerCase()
            .includes(normalized)
        })

        return { group, devices }
      })
      .filter(item => item.devices.length > 0)
  }, [config, query])

  if (!config) {
    return (
      <section className="panel empty-state">
        <h3>No launcher configured</h3>
        <p>Device buttons have not yet been configured for {siteName}.</p>
      </section>
    )
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroups(current => {
      const next = new Set(current)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  function setAllGroups(collapsed: boolean) {
    setCollapsedGroups(
      collapsed ? new Set(config.groups.map(group => group.id)) : new Set(),
    )
  }

  const devicesWithMaps = config.devices.filter(device => device.details)

  return (
    <section className="launcher">
      <div className="launcher-toolbar">
        <input
          className="search launcher-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search devices, groups, zones or outlets..."
          aria-label="Search device launcher"
        />

        <div className="launcher-actions">
          <button type="button" onClick={() => setAllGroups(false)}>Expand all</button>
          <button type="button" onClick={() => setAllGroups(true)}>Collapse all</button>
          <button type="button" onClick={() => setShowAllMaps(true)}>
            Open all maps
          </button>
        </div>
      </div>

      <p className="launcher-network-note">
        Device pages are available only while your computer has access to the
        site network or VPN.
      </p>

      {visibleGroups.length === 0 ? (
        <article className="panel empty-state">
          <h3>No matching devices</h3>
          <p>Try another device, group, room, zone or outlet.</p>
        </article>
      ) : (
        visibleGroups.map(({ group, devices }) => {
          const collapsed = collapsedGroups.has(group.id)

          return (
            <section
              className="launcher-group"
              key={group.id}
              style={{ '--launcher-accent': group.accent } as CSSProperties}
            >
              <button
                className="launcher-group-heading"
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={!collapsed}
              >
                <span>
                  <span className="launcher-group-dot" />
                  {group.title}
                </span>
                <small>{devices.length} devices</small>
                <strong aria-hidden="true">{collapsed ? '+' : '−'}</strong>
              </button>

              {!collapsed && (
                <div className="launcher-grid">
                  {devices.map(device => (
                    <article className="launcher-card" key={device.id}>
                      <div className="launcher-card-copy">
                        <p className="eyebrow">
                          {device.details ? device.details.title : group.title}
                        </p>
                        <h3>{device.title}</h3>
                        <span>{device.link}</span>
                      </div>

                      <div className="launcher-card-actions">
                        {device.details && (
                          <button type="button" onClick={() => setSelectedDevice(device)}>
                            View map
                          </button>
                        )}
                        <a href={device.link} target="_blank" rel="noreferrer">
                          Open device
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}

      {selectedDevice?.details && (
        <div className="launcher-modal-backdrop" onMouseDown={() => setSelectedDevice(null)}>
          <section
            className="launcher-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={event => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">{selectedDevice.details.title}</p>
                <h2>{selectedDevice.title}</h2>
              </div>
              <button
                type="button"
                className="launcher-close"
                onClick={() => setSelectedDevice(null)}
                aria-label="Close map"
              >
                ×
              </button>
            </header>

            <DetailTable details={selectedDevice.details} />

            <footer>
              <a href={selectedDevice.link} target="_blank" rel="noreferrer">
                Open device
              </a>
            </footer>
          </section>
        </div>
      )}

      {showAllMaps && (
        <div className="launcher-modal-backdrop" onMouseDown={() => setShowAllMaps(false)}>
          <section
            className="launcher-modal launcher-modal-wide"
            role="dialog"
            aria-modal="true"
            onMouseDown={event => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">DEVICE REFERENCE</p>
                <h2>{siteName} maps</h2>
              </div>
              <button
                type="button"
                className="launcher-close"
                onClick={() => setShowAllMaps(false)}
                aria-label="Close maps"
              >
                ×
              </button>
            </header>

            <div className="launcher-all-maps">
              {devicesWithMaps.map(device => (
                <article className="launcher-map-section" key={device.id}>
                  <div className="launcher-map-heading">
                    <div>
                      <p className="eyebrow">{device.details?.title}</p>
                      <h3>{device.title}</h3>
                    </div>
                    <a href={device.link} target="_blank" rel="noreferrer">
                      Open device
                    </a>
                  </div>
                  {device.details && <DetailTable details={device.details} />}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
