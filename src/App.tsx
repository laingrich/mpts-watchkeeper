import sites from './data/sites.json'
import { useMemo, useState } from 'react'
import UserMenu from './UserMenu'

type Device = {
  name: string
  group: string
  url: string
}

type Site = {
  id: string
  name: string
  type: string
  status: string
  devices: Device[]
}

const tabs = ['Overview', 'Devices', 'Documents', 'Issues'] as const
type Tab = typeof tabs[number]

export default function App() {
  const siteList = sites as Site[]

  const [selectedSiteId, setSelectedSiteId] = useState(siteList[0].id)
  const [tab, setTab] = useState<Tab>('Overview')
  const [query, setQuery] = useState('')

  const site =
    siteList.find(item => item.id === selectedSiteId) ?? siteList[0]

  const groups = useMemo(() => {
    const filtered = site.devices.filter(device =>
      `${device.name} ${device.group}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )

    return filtered.reduce<Record<string, Device[]>>((acc, device) => {
      acc[device.group] ??= []
      acc[device.group].push(device)
      return acc
    }, {})
  }, [site.devices, query])

  function changeSite(siteId: string) {
    setSelectedSiteId(siteId)
    setQuery('')
    setTab('Overview')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">MP TECHNICAL SERVICES · WATCHKEEPER</div>
          <h1>Watchkeeper</h1>
        </div>

        <div className="header-actions">
          <div className="site-selector">
          <span
            className={`status-dot ${
              site.status !== 'Online' ? 'status-dot-pending' : ''
            }`}
          />

          <select
            value={selectedSiteId}
            onChange={event => changeSite(event.target.value)}
            aria-label="Select site"
          >
            {siteList.map(item => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          </div>

          <UserMenu />
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">CURRENT SITE</p>
            <h2>{site.name}</h2>
            <p>{site.type} support and monitoring portal</p>
          </div>

          <div className="status-card">
            <span
              className={`status-dot ${
                site.status !== 'Online' ? 'status-dot-pending' : ''
              }`}
            />
            <strong>{site.status}</strong>
            <small>
              {site.status === 'Online'
                ? 'Last checked just now'
                : 'Site onboarding not complete'}
            </small>
          </div>
        </section>

        <nav className="tabs" aria-label="Watchkeeper sections">
          {tabs.map(item => (
            <button
              key={item}
              className={tab === item ? 'active' : ''}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        {tab === 'Overview' && (
          <section className="grid three">
            <article className="panel">
              <p className="eyebrow">DEVICES</p>
              <h3>{site.devices.length}</h3>
              <p>Configured devices</p>
            </article>

            <article className="panel">
              <p className="eyebrow">OPEN ISSUES</p>
              <h3>0</h3>
              <p>No active support issues</p>
            </article>

            <article className="panel">
              <p className="eyebrow">DOCUMENTS</p>
              <h3>SharePoint</h3>
              <p>Document integration placeholder</p>
            </article>
          </section>
        )}

        {tab === 'Devices' && (
          <section>
            <input
              className="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search devices..."
            />

            {site.devices.length === 0 ? (
              <article className="panel empty-state">
                <h3>No devices configured</h3>
                <p>
                  Devices will appear here when onboarding for {site.name} is
                  completed.
                </p>
              </article>
            ) : (
              Object.entries(groups).map(([group, devices]) => (
                <div className="device-group" key={group}>
                  <h3>{group}</h3>

                  <div className="grid cards">
                    {devices.map(device => (
                      <a
                        className="device-card"
                        href={device.url}
                        target="_blank"
                        rel="noreferrer"
                        key={device.name}
                      >
                        <strong>{device.name}</strong>
                        <span>{device.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {tab === 'Documents' && (
          <section className="panel empty-state">
            <h3>Site documentation</h3>
            <p>
              This section will connect to the {site.name} SharePoint document
              library.
            </p>
          </section>
        )}

        {tab === 'Issues' && (
          <section className="panel empty-state">
            <h3>Issue management</h3>
            <p>
              No open issues. A later API will store issues, updates, owners
              and service history.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
