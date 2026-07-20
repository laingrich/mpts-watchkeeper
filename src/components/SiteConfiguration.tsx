import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import {
  accessProviderDescriptions,
  accessProviderLabels,
  createDefaultClientSettings,
  normaliseClientSettings,
  type AccessProvider,
  type ClientSettings,
  type ClientSettingsResponse,
  type DiscoveryMethod,
  type RemoteSupportMethod,
  type SiteType,
} from '../clientSettings'
import './SiteConfiguration.css'

type SiteConfigurationProps = {
  clientId: string
  clientName: string
  onSettingsChanged?: (settings: ClientSettings) => void
}

const accessProviders = Object.entries(
  accessProviderLabels,
) as [AccessProvider, string][]

const siteTypes: [SiteType, string][] = [
  ['not-set', 'Not set'],
  ['residential', 'Residential'],
  ['marine', 'Marine / yacht'],
  ['commercial', 'Commercial'],
  ['other', 'Other'],
]

const discoveryMethods: [DiscoveryMethod, string][] = [
  ['manual', 'Manual device list'],
  ['domotz', 'Domotz'],
  ['unifi', 'UniFi controller'],
  ['watchkeeper-agent', 'Watchkeeper onsite agent'],
]

const remoteSupportMethods: [RemoteSupportMethod, string][] = [
  ['none', 'Not configured'],
  ['windows-rdp', 'Windows Remote Desktop'],
  ['chrome-remote-desktop', 'Chrome Remote Desktop'],
  ['teamviewer', 'TeamViewer'],
  ['quick-assist', 'Microsoft Quick Assist'],
  ['other', 'Other'],
]

export default function SiteConfiguration({
  clientId,
  clientName,
  onSettingsChanged,
}: SiteConfigurationProps) {
  const [settings, setSettings] = useState<ClientSettings>(
    createDefaultClientSettings,
  )
  const [etag, setEtag] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] =
    useState<string | null>(null)
  const [updatedBy, setUpdatedBy] =
    useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    void loadSettings()
  }, [clientId])

  async function loadSettings() {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(
        `/api/client-settings/${encodeURIComponent(clientId)}`,
        {
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        },
      )

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const data =
        (await response.json()) as ClientSettingsResponse
      const normalised = normaliseClientSettings(data.settings)

      setSettings(normalised)
      setEtag(data.etag)
      setUpdatedAt(data.updatedAt)
      setUpdatedBy(data.updatedBy)
      setIsDirty(false)
      onSettingsChanged?.(normalised)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load site configuration',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function updateSettings(
    updater: (current: ClientSettings) => ClientSettings,
  ) {
    setSettings(current => updater(current))
    setIsDirty(true)
    setSuccess(null)
  }

  async function saveSettings(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      if (etag) {
        headers['If-Match'] = etag
      }

      const response = await fetch(
        `/api/client-settings/${encodeURIComponent(clientId)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(settings),
        },
      )

      if (response.status === 409) {
        throw new Error(
          'Another user changed this configuration. Reload it before saving again.',
        )
      }

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const data =
        (await response.json()) as ClientSettingsResponse
      const normalised = normaliseClientSettings(data.settings)

      setSettings(normalised)
      setEtag(data.etag)
      setUpdatedAt(data.updatedAt)
      setUpdatedBy(data.updatedBy)
      setIsDirty(false)
      setSuccess('Site configuration saved centrally.')
      onSettingsChanged?.(normalised)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save site configuration',
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="panel empty-state">
        <h3>Loading site configuration</h3>
        <p>Retrieving the settings for {clientName}…</p>
      </section>
    )
  }

  return (
    <section className="site-config-page">
      <header className="site-config-header">
        <div>
          <p className="eyebrow">SITE CONFIGURATION</p>
          <h3>{clientName}</h3>
          <p>
            Configure access, monitoring and support behaviour for this
            Jetbuilt client.
          </p>
        </div>

        <div className="site-config-header-meta">
          <span>Administrator only</span>
          {updatedAt && (
            <small>
              Updated {formatDate(updatedAt)}
              {updatedBy ? ` by ${updatedBy}` : ''}
            </small>
          )}
        </div>
      </header>

      <form className="site-config-form" onSubmit={saveSettings}>
        {success && (
          <div className="site-config-message success" role="status">
            {success}
          </div>
        )}

        {error && (
          <div className="site-config-message error" role="alert">
            {error}
          </div>
        )}

        <section className="panel site-config-section">
          <div className="site-config-section-heading">
            <div>
              <p className="eyebrow">SITE</p>
              <h4>Site metadata</h4>
            </div>
            <span>Basic onboarding information</span>
          </div>

          <div className="site-config-grid three">
            <label className="site-config-field">
              <span>Site type</span>
              <select
                value={settings.site.type}
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    site: {
                      ...current.site,
                      type: event.target.value as SiteType,
                    },
                  }))
                }
              >
                {siteTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="site-config-field">
              <span>Site/reference name</span>
              <input
                value={settings.site.reference}
                placeholder="Property, vessel or internal reference"
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    site: {
                      ...current.site,
                      reference: event.target.value,
                    },
                  }))
                }
              />
            </label>

            <label className="site-config-field">
              <span>Timezone</span>
              <input
                value={settings.site.timezone}
                placeholder="Europe/London"
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    site: {
                      ...current.site,
                      timezone: event.target.value,
                    },
                  }))
                }
              />
            </label>

            <label className="site-config-field full-width">
              <span>Technical notes</span>
              <textarea
                value={settings.site.notes}
                placeholder="Important site constraints, access notes or technical context"
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    site: {
                      ...current.site,
                      notes: event.target.value,
                    },
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="panel site-config-section">
          <div className="site-config-section-heading">
            <div>
              <p className="eyebrow">ACCESS</p>
              <h4>Access provider</h4>
            </div>
            <span>How engineers reach the site</span>
          </div>

          <div className="site-config-provider-grid">
            {accessProviders.map(([value, label]) => (
              <button
                className={
                  settings.access.provider === value ? 'selected' : ''
                }
                key={value}
                type="button"
                onClick={() =>
                  updateSettings(current => ({
                    ...current,
                    access: {
                      ...current.access,
                      provider: value,
                    },
                  }))
                }
              >
                <strong>{label}</strong>
                <small>{accessProviderDescriptions[value]}</small>
              </button>
            ))}
          </div>

          <div className="site-config-grid two">
            <label className="site-config-field">
              <span>Site reachability probe</span>
              <input
                value={settings.access.probeTarget}
                placeholder="For example http://192.168.2.10/"
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    access: {
                      ...current.access,
                      probeTarget: event.target.value,
                    },
                  }))
                }
              />
              <small>
                A unique local target that can confirm the correct site is
                reachable.
              </small>
            </label>

            <label className="site-config-field">
              <span>Access notes</span>
              <textarea
                value={settings.access.notes}
                placeholder="Profile naming, gateway details or engineer instructions"
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    access: {
                      ...current.access,
                      notes: event.target.value,
                    },
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="panel site-config-section">
          <div className="site-config-section-heading">
            <div>
              <p className="eyebrow">MONITORING</p>
              <h4>Health checks</h4>
            </div>
            <Toggle
              checked={settings.monitoring.enabled}
              label="Monitoring enabled"
              onChange={checked =>
                updateSettings(current => ({
                  ...current,
                  monitoring: {
                    ...current.monitoring,
                    enabled: checked,
                  },
                }))
              }
            />
          </div>

          <div className="site-config-grid three">
            <label className="site-config-field">
              <span>Poll interval</span>
              <select
                value={settings.monitoring.pollIntervalMinutes}
                disabled={!settings.monitoring.enabled}
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    monitoring: {
                      ...current.monitoring,
                      pollIntervalMinutes: Number(event.target.value),
                    },
                  }))
                }
              >
                <option value={1}>Every minute</option>
                <option value={5}>Every 5 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
              </select>
            </label>

            <label className="site-config-field">
              <span>Monitoring probe target</span>
              <input
                disabled={!settings.monitoring.enabled}
                value={settings.monitoring.probeTarget}
                placeholder="Optional site health endpoint or IP"
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    monitoring: {
                      ...current.monitoring,
                      probeTarget: event.target.value,
                    },
                  }))
                }
              />
            </label>

            <div className="site-config-check-list">
              <Toggle
                checked={settings.monitoring.internetCheckEnabled}
                disabled={!settings.monitoring.enabled}
                label="Internet availability"
                onChange={checked =>
                  updateSettings(current => ({
                    ...current,
                    monitoring: {
                      ...current.monitoring,
                      internetCheckEnabled: checked,
                    },
                  }))
                }
              />
              <Toggle
                checked={settings.monitoring.coreDeviceChecksEnabled}
                disabled={!settings.monitoring.enabled}
                label="Core device checks"
                onChange={checked =>
                  updateSettings(current => ({
                    ...current,
                    monitoring: {
                      ...current.monitoring,
                      coreDeviceChecksEnabled: checked,
                    },
                  }))
                }
              />
              <Toggle
                checked={settings.monitoring.domotzEnabled}
                disabled={!settings.monitoring.enabled}
                label="Domotz source available"
                onChange={checked =>
                  updateSettings(current => ({
                    ...current,
                    monitoring: {
                      ...current.monitoring,
                      domotzEnabled: checked,
                    },
                  }))
                }
              />
            </div>
          </div>
        </section>

        <section className="panel site-config-section">
          <div className="site-config-section-heading">
            <div>
              <p className="eyebrow">DISCOVERY</p>
              <h4>Device discovery</h4>
            </div>
            <Toggle
              checked={settings.discovery.enabled}
              label="Discovery enabled"
              onChange={checked =>
                updateSettings(current => ({
                  ...current,
                  discovery: {
                    ...current.discovery,
                    enabled: checked,
                  },
                }))
              }
            />
          </div>

          <div className="site-config-grid two">
            <label className="site-config-field">
              <span>Discovery source</span>
              <select
                disabled={!settings.discovery.enabled}
                value={settings.discovery.method}
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    discovery: {
                      ...current.discovery,
                      method: event.target.value as DiscoveryMethod,
                    },
                  }))
                }
              >
                {discoveryMethods.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="site-config-field">
              <span>Primary LAN subnet</span>
              <input
                disabled={!settings.discovery.enabled}
                value={settings.discovery.subnet}
                placeholder="For example 192.168.2.0/24"
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    discovery: {
                      ...current.discovery,
                      subnet: event.target.value,
                    },
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="panel site-config-section">
          <div className="site-config-section-heading">
            <div>
              <p className="eyebrow">SUPPORT</p>
              <h4>Remote support</h4>
            </div>
            <span>Desktop and attended-session options</span>
          </div>

          <div className="site-config-grid two">
            <label className="site-config-field">
              <span>Remote desktop method</span>
              <select
                value={settings.remoteSupport.method}
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    remoteSupport: {
                      ...current.remoteSupport,
                      method: event.target.value as RemoteSupportMethod,
                    },
                  }))
                }
              >
                {remoteSupportMethods.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="site-config-check-list single">
              <Toggle
                checked={
                  settings.remoteSupport.clientApprovalRequired
                }
                label="Client approval required"
                onChange={checked =>
                  updateSettings(current => ({
                    ...current,
                    remoteSupport: {
                      ...current.remoteSupport,
                      clientApprovalRequired: checked,
                    },
                  }))
                }
              />
            </div>

            <label className="site-config-field full-width">
              <span>Support instructions</span>
              <textarea
                value={settings.remoteSupport.instructions}
                placeholder="Steps for starting an approved support session or reaching the onsite PC"
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    remoteSupport: {
                      ...current.remoteSupport,
                      instructions: event.target.value,
                    },
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="panel site-config-section">
          <div className="site-config-section-heading">
            <div>
              <p className="eyebrow">NOTIFICATIONS</p>
              <h4>Alert delivery</h4>
            </div>
            <Toggle
              checked={settings.notifications.enabled}
              label="Notifications enabled"
              onChange={checked =>
                updateSettings(current => ({
                  ...current,
                  notifications: {
                    ...current.notifications,
                    enabled: checked,
                  },
                }))
              }
            />
          </div>

          <div className="site-config-grid two">
            <label className="site-config-field">
              <span>Notification recipients</span>
              <textarea
                disabled={!settings.notifications.enabled}
                value={settings.notifications.recipients.join('\n')}
                placeholder="One email address per line"
                onChange={event =>
                  updateSettings(current => ({
                    ...current,
                    notifications: {
                      ...current.notifications,
                      recipients: event.target.value
                        .split(/\r?\n|,/)
                        .map(item => item.trim())
                        .filter(Boolean),
                    },
                  }))
                }
              />
            </label>

            <div className="site-config-check-list single">
              <Toggle
                checked={settings.notifications.criticalOnly}
                disabled={!settings.notifications.enabled}
                label="Critical alerts only"
                onChange={checked =>
                  updateSettings(current => ({
                    ...current,
                    notifications: {
                      ...current.notifications,
                      criticalOnly: checked,
                    },
                  }))
                }
              />
            </div>
          </div>
        </section>

        <section className="panel site-config-section">
          <div className="site-config-section-heading">
            <div>
              <p className="eyebrow">DOCUMENTATION</p>
              <h4>SharePoint folder</h4>
            </div>
            <span>Also editable from the Documents tab</span>
          </div>

          <label className="site-config-field">
            <span>SharePoint folder URL</span>
            <input
              type="url"
              value={settings.sharePointUrl}
              placeholder="https://tenant.sharepoint.com/sites/..."
              onChange={event =>
                updateSettings(current => ({
                  ...current,
                  sharePointUrl: event.target.value,
                }))
              }
            />
          </label>
        </section>

        <footer className="site-config-actions">
          <div>
            <strong>
              {isDirty ? 'Unsaved changes' : 'Configuration up to date'}
            </strong>
            <small>
              Settings are stored centrally against the Jetbuilt client ID.
            </small>
          </div>

          <div>
            <button
              className="site-config-secondary-button"
              type="button"
              disabled={isSaving}
              onClick={() => void loadSettings()}
            >
              Reload
            </button>
            <button
              className="site-config-primary-button"
              type="submit"
              disabled={!isDirty || isSaving}
            >
              {isSaving ? 'Saving…' : 'Save site configuration'}
            </button>
          </div>
        </footer>
      </form>
    </section>
  )
}

type ToggleProps = {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}

function Toggle({
  checked,
  disabled = false,
  label,
  onChange,
}: ToggleProps) {
  return (
    <label className="site-config-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
      />
      <span aria-hidden="true" />
      <strong>{label}</strong>
    </label>
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
