import { useEffect, useMemo, useState } from 'react'
import UserMenu, { type ClientPrincipal } from './UserMenu'
import DeviceLauncher, { getLauncherDeviceCount } from './components/DeviceLauncher'

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

type SitesResponse = {
  sites: Site[]
  count: number
}

const tabs = ['Overview', 'Devices', 'Documents', 'Issues', 'Access'] as const
type Tab = (typeof tabs)[number]

export default function App() {
  const [siteList, setSiteList] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [tab, setTab] = useState<Tab>('Overview')
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] =
    useState<ClientPrincipal | null>(null)

  useEffect(() => {
    async function loadSites() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch('/api/sites', {
          headers: {
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const data = (await response.json()) as SitesResponse

        if (!Array.isArray(data.sites)) {
          throw new Error('The sites API returned invalid data')
        }

        setSiteList(data.sites)

        if (data.sites.length > 0) {
          setSelectedSiteId(currentId => currentId || data.sites[0].id)
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load Watchkeeper sites'

        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    void loadSites()
  }, [])

  const site = useMemo(
    () =>
      siteList.find(item => item.id === selectedSiteId) ??
      siteList[0] ??
      null,
    [siteList, selectedSiteId],
  )

  const groups = useMemo(() => {
    if (!site) {
      return {}
    }

    const filtered = site.devices.filter(device =>
      `${device.name} ${device.group}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )

    return filtered.reduce<Record<string, Device[]>>((acc, device) => {
      acc[device.group] ??= []
      acc[device.group].push(device)
      return acc
    }, {})
  }, [site, query])

  function changeSite(siteId: string) {
    setSelectedSiteId(siteId)
    setQuery('')
    setTab('Overview')
  }

  const isAdmin =
    currentUser?.userRoles.includes('watchkeeper_admin') ?? false

  const visibleTabs = isAdmin
    ? tabs
    : tabs.filter(item => item !== 'Access')

  if (isLoading) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              MP TECHNICAL SERVICES · WATCHKEEPER
            </div>
            <h1>Watchkeeper</h1>
          </div>

          <UserMenu onUserLoaded={setCurrentUser} />
        </header>

        <main>
          <section className="panel empty-state">
            <h3>Loading sites</h3>
            <p>Retrieving Watchkeeper site information…</p>
          </section>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              MP TECHNICAL SERVICES · WATCHKEEPER
            </div>
            <h1>Watchkeeper</h1>
          </div>

          <UserMenu onUserLoaded={setCurrentUser} />
        </header>

        <main>
          <section className="panel empty-state">
            <h3>Unable to load sites</h3>
            <p>{error}</p>

            <button
              className="retry-button"
              type="button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </section>
        </main>
      </div>
    )
  }

  if (!site) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              MP TECHNICAL SERVICES · WATCHKEEPER
            </div>
            <h1>Watchkeeper</h1>
          </div>

          <UserMenu onUserLoaded={setCurrentUser} />
        </header>

        <main>
          <section className="panel empty-state">
            <h3>No sites configured</h3>
            <p>Add a site through the Watchkeeper backend.</p>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            MP TECHNICAL SERVICES · WATCHKEEPER
          </div>
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

          <UserMenu onUserLoaded={setCurrentUser} />
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
          {visibleTabs.map(item => (
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
              <h3>{getLauncherDeviceCount(site.id, site.devices.length)}</h3>
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
          <DeviceLauncher
            siteId={site.id}
            siteName={site.name}
          />
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
              No open issues. The backend will store issues, updates, owners
              and service history.
            </p>
          </section>
        )}

        {tab === 'Access' && isAdmin && (
          <section className="panel empty-state">
            <p className="eyebrow">ACCESS MANAGEMENT</p>
            <h3>Users and roles</h3>
            <p>
              Manage administrator and engineer access to Watchkeeper.
              Clients and sites are managed through Jetbuilt.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
