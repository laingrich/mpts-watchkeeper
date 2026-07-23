import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import UserMenu, { type ClientPrincipal } from './UserMenu'
import DeviceLauncher from './components/DeviceLauncher'
import ClientPicker from './components/ClientPicker'
import SharePointClientLink from './components/SharePointClientLink'
import VpnConnection from './components/VpnConnection'
import SystemHealthDashboard from './components/SystemHealthDashboard'
import IssueManagement from './components/IssueManagement'
import ServiceReportForm from './components/ServiceReportForm'
import SiteConfiguration from './components/SiteConfiguration'
import {
  accessProviderDescriptions,
  accessProviderLabels,
  createDefaultClientSettings,
  normaliseClientSettings,
  type AccessProvider,
  type ClientSettings,
  type ClientSettingsResponse,
} from './clientSettings'

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
  'Submit service report',
  'Site configuration',
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
  const [deviceCounts, setDeviceCounts] =
    useState<Record<string, number>>({})
  const [clientSettings, setClientSettings] =
    useState<ClientSettings>(createDefaultClientSettings)

  useEffect(() => {
    void loadClients()
  }, [])

  useEffect(() => {
    if (!selectedClientId) return

    setClientSettings(createDefaultClientSettings())
    void loadDeviceCount(selectedClientId)
    void loadClientSettings(selectedClientId)
  }, [selectedClientId])

  async function loadClients(forceRefresh = false) {
    setIsLoading(true)
    setError(null)

    try {
      const endpoint = forceRefresh
        ? '/api/clients?refresh=true'
        : '/api/clients'
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) throw new Error(await readError(response))

      const data = (await response.json()) as ClientsResponse
      if (!Array.isArray(data.clients)) {
        throw new Error('Jetbuilt returned invalid client data')
      }

      setClientList(data.clients)
      setFetchedAt(data.fetchedAt)

      if (data.clients.length > 0) {
        setSelectedClientId(currentId =>
          data.clients.some(client => client.id === currentId)
            ? currentId
            : data.clients[0].id,
        )
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

  async function loadDeviceCount(clientId: string) {
    try {
      const response = await fetch(
        `/api/device-config/${encodeURIComponent(clientId)}`,
        { headers: { Accept: 'application/json' } },
      )

      if (response.status === 404) {
        setDeviceCounts(current => ({ ...current, [clientId]: 0 }))
        return
      }
      if (!response.ok) return

      const data = (await response.json()) as {
        config?: { devices?: unknown[] }
      }
      const count = Array.isArray(data.config?.devices)
        ? data.config.devices.length
        : 0

      setDeviceCounts(current => ({ ...current, [clientId]: count }))
    } catch {
      // Keep the existing displayed count if the request fails.
    }
  }

  async function loadClientSettings(clientId: string) {
    try {
      const response = await fetch(
        `/api/client-settings/${encodeURIComponent(clientId)}`,
        {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        },
      )
      if (!response.ok) return

      const data = (await response.json()) as ClientSettingsResponse
      setClientSettings(normaliseClientSettings(data.settings))
    } catch {
      // The page remains usable with default settings.
    }
  }

  const client = useMemo(
    () =>
      clientList.find(item => item.id === selectedClientId) ??
      clientList[0] ??
      null,
    [clientList, selectedClientId],
  )

  const isAdmin =
    currentUser?.userRoles.includes('watchkeeper_admin') ?? false
  const visibleTabs = isAdmin
    ? tabs
    : tabs.filter(item => item !== 'Site configuration')

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
            Watchkeeper could not find any clients in the connected Jetbuilt
            account.
          </p>
        </section>
      </PageShell>
    )
  }

  const launcherDeviceCount = deviceCounts[client.id] ?? 0

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
          <ClientPicker
            clients={clientList}
            selectedClientId={selectedClientId}
            onChange={changeClient}
          />
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

          <ConnectionsCard
            fetchedAt={fetchedAt}
            clientId={client.id}
            clientName={client.name}
            accessProvider={clientSettings.access.provider}
          />
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
          <div className="overview-stack">
            <section className="grid three">
              <button
                className="panel overview-card"
                type="button"
                onClick={() => setTab('Devices')}
              >
                <p className="eyebrow">DEVICES</p>
                <h3>{launcherDeviceCount}</h3>
                <p>Configured Watchkeeper devices</p>
                <span className="overview-card-link">View devices →</span>
              </button>

              <button
                className="panel overview-card"
                type="button"
                onClick={() => setTab('Documents')}
              >
                <p className="eyebrow">DOCUMENTS</p>
                <h3>SharePoint + Artura</h3>
                <p>Project files, site records and engineering information</p>
                <span className="overview-card-link">View documents →</span>
              </button>

              <button
                className="panel overview-card"
                type="button"
                onClick={() => setTab('Issues')}
              >
                <p className="eyebrow">OPEN ISSUES</p>
                <h3>0</h3>
                <p>Mock Jetbuilt issue workflow available</p>
                <span className="overview-card-link">View issues →</span>
              </button>
            </section>

            <SystemHealthDashboard
              clientName={client.name}
              configuredDeviceCount={launcherDeviceCount}
              onOpenDevices={() => setTab('Devices')}
              monitoring={clientSettings.monitoring}
              discovery={clientSettings.discovery}
            />
          </div>
        )}

        {tab === 'Devices' && (
          <DeviceLauncher
            siteId={client.id}
            siteName={client.name}
            onDeviceCountChange={count =>
              setDeviceCounts(current => ({
                ...current,
                [client.id]: count,
              }))
            }
          />
        )}

        {tab === 'Documents' && (
          <SharePointClientLink
            clientId={client.id}
            clientName={client.name}
            onSettingsChanged={setClientSettings}
          />
        )}

        {tab === 'Issues' && (
          <IssueManagement
            clientId={client.id}
            clientName={client.name}
          />
        )}

        {tab === 'Submit service report' && (
          <ServiceReportForm
            clientId={client.id}
            clientName={client.name}
          />
        )}

        {tab === 'Site configuration' && isAdmin && (
          <SiteConfiguration
            clientId={client.id}
            clientName={client.name}
            onSettingsChanged={setClientSettings}
          />
        )}
      </main>
    </div>
  )
}

type ConnectionsCardProps = {
  fetchedAt: string | null
  clientId: string
  clientName: string
  accessProvider: AccessProvider
}

function ConnectionsCard({
  fetchedAt,
  clientId,
  clientName,
  accessProvider,
}: ConnectionsCardProps) {
  return (
    <aside className="hero-connections-card">
      <div className="hero-connections-heading">
        <p className="eyebrow">CONNECTIONS</p>
        <h3>Services and remote access</h3>
      </div>

      <div className="hero-connection-row">
        <span className="status-dot" />
        <div className="hero-connection-copy">
          <strong>Jetbuilt</strong>
          <small>
            {fetchedAt
              ? `Client list synced ${formatDate(fetchedAt)}`
              : 'Client list connected'}
          </small>
        </div>
        <span className="hero-connection-label">Connected</span>
      </div>

      <AccessConnection
        clientId={clientId}
        clientName={clientName}
        provider={accessProvider}
      />
    </aside>
  )
}

type AccessConnectionProps = {
  clientId: string
  clientName: string
  provider: AccessProvider
}

function AccessConnection({
  clientId,
  clientName,
  provider,
}: AccessConnectionProps) {
  if (provider === 'not-configured' || provider === 'unifi-teleport') {
    return <VpnConnection clientId={clientId} clientName={clientName} />
  }

  const status = accessProviderStatus(provider)

  return (
    <div className="hero-connection-row">
      <span className={`status-dot ${status.dotClass}`} />
      <div className="hero-connection-copy">
        <strong>{accessProviderLabels[provider]}</strong>
        <small>{accessProviderDescriptions[provider]}</small>
      </div>
      <span className="hero-connection-label">{status.label}</span>
    </div>
  )
}

function accessProviderStatus(provider: AccessProvider) {
  switch (provider) {
    case 'local-network':
      return { label: 'Local only', dotClass: 'hero-status-dot-muted' }
    case 'watchkeeper-pc':
    case 'unifi-wireguard':
      return { label: 'Configured', dotClass: 'status-dot-pending' }
    case 'attended-support':
      return { label: 'Approval required', dotClass: 'status-dot-pending' }
    default:
      return { label: 'Unavailable', dotClass: 'hero-status-dot-muted' }
  }
}

type PageShellProps = {
  children: ReactNode
  onUserLoaded: (user: ClientPrincipal | null) => void
}

function PageShell({ children, onUserLoaded }: PageShellProps) {
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
    const data = (await response.json()) as { error?: string }
    return data.error || `Request failed with status ${response.status}`
  } catch {
    return `Request failed with status ${response.status}`
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
