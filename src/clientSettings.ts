export type SiteType =
  | 'not-set'
  | 'residential'
  | 'marine'
  | 'commercial'
  | 'other'

export type AccessProvider =
  | 'not-configured'
  | 'local-network'
  | 'watchkeeper-pc'
  | 'unifi-teleport'
  | 'unifi-wireguard'
  | 'attended-support'
  | 'none'

export type MonitoringSource =
  | 'none'
  | 'domotz'
  | 'watchkeeper-agent'
  | 'basic-checks'

export type RemoteSupportMethod =
  | 'none'
  | 'windows-rdp'
  | 'chrome-remote-desktop'
  | 'teamviewer'
  | 'quick-assist'
  | 'other'

export type ClientSettings = {
  schemaVersion: 2
  sharePointUrl: string
  arturaUrl: string
  site: {
    type: SiteType
    reference: string
    timezone: string
    notes: string
  }
  access: {
    provider: AccessProvider
    probeTarget: string
    notes: string
  }
  monitoring: {
    source: MonitoringSource
    pollIntervalMinutes: number
    internetCheckEnabled: boolean
    coreDeviceChecksEnabled: boolean
    probeTarget: string
  }
  discovery: {
    domotzEnabled: boolean
    unifiEnabled: boolean
    watchkeeperAgentEnabled: boolean
    subnet: string
  }
  remoteSupport: {
    method: RemoteSupportMethod
    clientApprovalRequired: boolean
    instructions: string
  }
  notifications: {
    enabled: boolean
    criticalOnly: boolean
    recipients: string[]
  }
}

export type ClientSettingsResponse = {
  settings: ClientSettings
  etag: string | null
  updatedAt: string | null
  updatedBy: string | null
}

type LegacyMonitoring = Partial<ClientSettings['monitoring']> & {
  enabled?: boolean
  domotzEnabled?: boolean
}

type LegacyDiscovery = Partial<ClientSettings['discovery']> & {
  enabled?: boolean
  method?: 'manual' | 'domotz' | 'unifi' | 'watchkeeper-agent'
}

export function createDefaultClientSettings(): ClientSettings {
  return {
    schemaVersion: 2,
    sharePointUrl: '',
    arturaUrl: 'https://app.artura.io',
    site: {
      type: 'not-set',
      reference: '',
      timezone: 'Europe/London',
      notes: '',
    },
    access: {
      provider: 'not-configured',
      probeTarget: '',
      notes: '',
    },
    monitoring: {
      source: 'none',
      pollIntervalMinutes: 5,
      internetCheckEnabled: true,
      coreDeviceChecksEnabled: true,
      probeTarget: '',
    },
    discovery: {
      domotzEnabled: false,
      unifiEnabled: false,
      watchkeeperAgentEnabled: false,
      subnet: '',
    },
    remoteSupport: {
      method: 'none',
      clientApprovalRequired: false,
      instructions: '',
    },
    notifications: {
      enabled: false,
      criticalOnly: false,
      recipients: [],
    },
  }
}

export function normaliseClientSettings(
  value: unknown,
): ClientSettings {
  const defaults = createDefaultClientSettings()

  if (!value || typeof value !== 'object') {
    return defaults
  }

  const input = value as Partial<ClientSettings> & {
    monitoring?: LegacyMonitoring
    discovery?: LegacyDiscovery
  }
  const monitoringInput: LegacyMonitoring = input.monitoring ?? {}
  const discoveryInput: LegacyDiscovery = input.discovery ?? {}

  return {
    ...defaults,
    ...input,
    schemaVersion: 2,
    sharePointUrl:
      typeof input.sharePointUrl === 'string'
        ? input.sharePointUrl
        : defaults.sharePointUrl,
    arturaUrl:
      typeof input.arturaUrl === 'string'
        ? input.arturaUrl
        : defaults.arturaUrl,
    site: {
      ...defaults.site,
      ...(input.site || {}),
    },
    access: {
      ...defaults.access,
      ...(input.access || {}),
    },
    monitoring: {
      ...defaults.monitoring,
      ...monitoringInput,
      source: normaliseMonitoringSource(monitoringInput),
    },
    discovery: {
      ...defaults.discovery,
      ...discoveryInput,
      domotzEnabled:
        typeof discoveryInput.domotzEnabled === 'boolean'
          ? discoveryInput.domotzEnabled
          : discoveryInput.enabled === true && discoveryInput.method === 'domotz',
      unifiEnabled:
        typeof discoveryInput.unifiEnabled === 'boolean'
          ? discoveryInput.unifiEnabled
          : discoveryInput.enabled === true && discoveryInput.method === 'unifi',
      watchkeeperAgentEnabled:
        typeof discoveryInput.watchkeeperAgentEnabled === 'boolean'
          ? discoveryInput.watchkeeperAgentEnabled
          : discoveryInput.enabled === true &&
            discoveryInput.method === 'watchkeeper-agent',
    },
    remoteSupport: {
      ...defaults.remoteSupport,
      ...(input.remoteSupport || {}),
    },
    notifications: {
      ...defaults.notifications,
      ...(input.notifications || {}),
      recipients: Array.isArray(input.notifications?.recipients)
        ? input.notifications.recipients.filter(
            item => typeof item === 'string',
          )
        : defaults.notifications.recipients,
    },
  }
}

function normaliseMonitoringSource(
  monitoring: LegacyMonitoring,
): MonitoringSource {
  if (
    monitoring.source === 'none' ||
    monitoring.source === 'domotz' ||
    monitoring.source === 'watchkeeper-agent' ||
    monitoring.source === 'basic-checks'
  ) {
    return monitoring.source
  }

  if (monitoring.enabled !== true) {
    return 'none'
  }

  return monitoring.domotzEnabled === true
    ? 'domotz'
    : 'basic-checks'
}

export const accessProviderLabels: Record<AccessProvider, string> = {
  'not-configured': 'Not configured',
  'local-network': 'Local network only',
  'watchkeeper-pc': 'Watchkeeper PC',
  'unifi-teleport': 'UniFi Teleport',
  'unifi-wireguard': 'UniFi WireGuard',
  'attended-support': 'Client-approved session',
  none: 'No remote access',
}

export const accessProviderDescriptions: Record<
  AccessProvider,
  string
> = {
  'not-configured':
    'Choose how engineers normally gain access to this client site.',
  'local-network':
    'Access is available only while physically connected to the client network.',
  'watchkeeper-pc':
    'A managed onsite Watchkeeper PC provides remote access and local services.',
  'unifi-teleport':
    'Engineers connect through WiFiman using an authorised UniFi Teleport profile.',
  'unifi-wireguard':
    'Engineers use an individually issued UniFi WireGuard client profile.',
  'attended-support':
    'The client must approve a temporary remote-support session on their own computer.',
  none: 'No remote method is available; a site visit is required.',
}
