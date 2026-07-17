import { useEffect, useMemo, useState } from 'react'
import UserMenu, { type ClientPrincipal } from './UserMenu'
import DeviceLauncher, {
  getLauncherDeviceCount,
} from './components/DeviceLauncher'

type JetbuiltClient = {
  id: string
  name: string
  active: boolean | null
  updatedAt: string | null
}

type ClientsResponse = {
  clients: JetbuiltClient[]
  count: number
  fetchedAt: string
  cached: boolean
  source: string
}

const tabs = [
  'Overview',
  'Devices',
  'Documents',
  'Issues',
  'Access',
] as const

type Tab = (typeof tabs)[number]

export default function App() {
  const [clientList, setClientList] = useState<JetbuiltClient[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [tab, setTab] = useState<Tab>('Overview')
  const [currentUser, setCurrentUser] =
    useState<ClientPrincipal | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  useEffect(() => {
    void loadClients()
  }, [])

  async function loadClients(forceRefresh = false) {
    setIsLoading(true)
    setError(null)

    try {
      const endpoint = forceRefresh
        ? '/api/clients?refresh=true'
        : '/api/clients'

      const response = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const data = (await response.json()) as ClientsResponse

      if (!Array.isArray(data.clients)) {
        throw new Error('Jetbuilt returned invalid client data')
      }

      setClientList(data.clients)
      setFetchedAt(data.fetchedAt)

      if (data.clients.length > 0) {
        setSelectedClientId(currentId => {
          const stillExists = data.clients.some(
            client => client.id === currentId,
          )

          return stillExists ? currentId : data.clients[0].id
        })
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to retrieve Jetbuilt clients',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const client = useMemo(
    () =>
      clientList.find(
        item => item.id === selectedClientId,
      ) ??
      clientList[0] ??
      null,
    [clientList, selectedClientId],
  )

  const isAdmin =
    currentUser?.userRoles.includes('watchkeeper_admin') ?? false

  const visibleTabs = isAdmin
    ? tabs
    : tabs.filter(item => item !== 'Access')

  function changeClient(clientId: string) {
    setSelectedClientId(clientId)
    setTab('Overview')
  }

  if (isLoading) {
    return (
      <PageShell onUserLoaded={setCurrentUser}>
        <section className="panel empty-state">
          <h3>Loading clients</h3>
          <p>Retrieving the current client list from Jetbuilt…</p>
        </section>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell onUserLoaded={setCurrentUser}>
        <section className="panel empty-state">
          <h3>Unable to load clients</h3>
          <p>{error}</p>

          <button
            className="retry-button"
            type="button"
            onClick={() => void loadClients(true)}
          >
            Try again
          </button>
        </section>
      </PageShell>
    )
  }

  if (!client) {
    return (
      <PageShell onUserLoaded={setCurrentUser}>
        <section className="panel empty-state">
          <h3>No Jetbuilt clients found</h3>
          <p>
            Watchkeeper could not find any clients in the connected
            Jetbuilt account.
          </p>
        </section>
      </PageShell>
    )
  }

  const launcherDeviceCount = getLauncherDeviceCount(
    client.id,
    0,
    client.name,
  )

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
            <span className="status-dot status-dot-source" />

            <select
              value={selectedClientId}
              onChange={event => changeClient(event.target.value)}
              aria-label="Select client"
            >
              {clientList.map(item => (
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
            <p className="eyebrow">CURRENT CLIENT</p>
            <h2>{client.name}</h2>
            <p>Technical support and monitoring portal</p>
          </div>

          <div className="status-card">
            <span className="status-dot status-dot-source" />
            <strong>Jetbuilt</strong>
            <small>
              {fetchedAt
                ? `Client list synced ${formatDate(fetchedAt)}`
                : 'Client record connected'}
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
              <h3>{launcherDeviceCount}</h3>
              <p>Configured Watchkeeper devices</p>
            </article>

            <article className="panel">
              <p className="eyebrow">OPEN ISSUES</p>
              <h3>0</h3>
              <p>Issue integration will be added later</p>
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
            siteId={client.id}
            siteName={client.name}
          />
        )}

        {tab === 'Documents' && (
          <section className="panel empty-state">
            <h3>Client documentation</h3>
            <p>
              This section will connect {client.name} to the
              appropriate SharePoint documentation.
            </p>
          </section>
        )}

        {tab === 'Issues' && (
          <section className="panel empty-state">
            <h3>Issue management</h3>
            <p>
              Service cases are deliberately excluded from the current
              Jetbuilt integration.
            </p>
          </section>
        )}

        {tab === 'Access' && isAdmin && (
          <section className="panel empty-state">
            <p className="eyebrow">ACCESS MANAGEMENT</p>
            <h3>Users and roles</h3>
            <p>
              Manage administrator and engineer access to
              Watchkeeper.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}

type PageShellProps = {
  children: React.ReactNode
  onUserLoaded: (user: ClientPrincipal | null) => void
}

function PageShell({
  children,
  onUserLoaded,
}: PageShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            MP TECHNICAL SERVICES · WATCHKEEPER
          </div>
          <h1>Watchkeeper</h1>
        </div>

        <UserMenu onUserLoaded={onUserLoaded} />
      </header>

      <main>{children}</main>
    </div>
  )
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as {
      error?: string
    }

    return data.error || `Request failed with status ${response.status}`
  } catch {
    return `Request failed with status ${response.status}`
  }
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}
