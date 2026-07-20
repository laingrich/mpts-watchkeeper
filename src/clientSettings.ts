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

export type DiscoveryMethod =
  | 'manual'
  | 'domotz'
  | 'unifi'
  | 'watchkeeper-agent'

export type RemoteSupportMethod =
  | 'none'
  | 'windows-rdp'
  | 'chrome-remote-desktop'
  | 'teamviewer'
  | 'quick-assist'
  | 'other'

export type ClientSettings = {
  schemaVersion: 1
  sharePointUrl: string
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
    enabled: boolean
    pollIntervalMinutes: number
    internetCheckEnabled: boolean
    coreDeviceChecksEnabled: boolean
    domotzEnabled: boolean
    probeTarget: string
  }
  discovery: {
    enabled: boolean
    method: DiscoveryMethod
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

export function createDefaultClientSettings(): ClientSettings {
  return {
    schemaVersion: 1,
    sharePointUrl: '',
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
      enabled: false,
      pollIntervalMinutes: 5,
      internetCheckEnabled: true,
      coreDeviceChecksEnabled: true,
      domotzEnabled: false,
      probeTarget: '',
    },
    discovery: {
      enabled: false,
      method: 'manual',
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

  const input = value as Partial<ClientSettings>

  return {
    ...defaults,
    ...input,
    schemaVersion: 1,
    sharePointUrl:
      typeof input.sharePointUrl === 'string'
        ? input.sharePointUrl
        : defaults.sharePointUrl,
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
      ...(input.monitoring || {}),
    },
    discovery: {
      ...defaults.discovery,
      ...(input.discovery || {}),
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
