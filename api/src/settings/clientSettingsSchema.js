const siteTypes = new Set([
  'not-set',
  'residential',
  'marine',
  'commercial',
  'other'
])

const accessProviders = new Set([
  'not-configured',
  'local-network',
  'watchkeeper-pc',
  'unifi-teleport',
  'unifi-wireguard',
  'attended-support',
  'none'
])

const discoveryMethods = new Set([
  'manual',
  'domotz',
  'unifi',
  'watchkeeper-agent'
])

const remoteSupportMethods = new Set([
  'none',
  'windows-rdp',
  'chrome-remote-desktop',
  'teamviewer',
  'quick-assist',
  'other'
])

function defaultClientSettings() {
  return {
    schemaVersion: 1,
    sharePointUrl: '',
    site: {
      type: 'not-set',
      reference: '',
      timezone: 'Europe/London',
      notes: ''
    },
    access: {
      provider: 'not-configured',
      probeTarget: '',
      notes: ''
    },
    monitoring: {
      enabled: false,
      pollIntervalMinutes: 5,
      internetCheckEnabled: true,
      coreDeviceChecksEnabled: true,
      domotzEnabled: false,
      probeTarget: ''
    },
    discovery: {
      enabled: false,
      method: 'manual',
      subnet: ''
    },
    remoteSupport: {
      method: 'none',
      clientApprovalRequired: false,
      instructions: ''
    },
    notifications: {
      enabled: false,
      criticalOnly: false,
      recipients: []
    }
  }
}

function normaliseClientSettings(value) {
  const defaults = defaultClientSettings()
  const input = isObject(value) ? value : {}

  return validateClientSettings({
    ...defaults,
    ...input,
    schemaVersion: 1,
    site: {
      ...defaults.site,
      ...(isObject(input.site) ? input.site : {})
    },
    access: {
      ...defaults.access,
      ...(isObject(input.access) ? input.access : {})
    },
    monitoring: {
      ...defaults.monitoring,
      ...(isObject(input.monitoring)
        ? input.monitoring
        : {})
    },
    discovery: {
      ...defaults.discovery,
      ...(isObject(input.discovery)
        ? input.discovery
        : {})
    },
    remoteSupport: {
      ...defaults.remoteSupport,
      ...(isObject(input.remoteSupport)
        ? input.remoteSupport
        : {})
    },
    notifications: {
      ...defaults.notifications,
      ...(isObject(input.notifications)
        ? input.notifications
        : {})
    }
  })
}

function mergeClientSettings(current, patch) {
  if (!isObject(patch)) {
    throw new Error('Invalid client settings')
  }

  const base = normaliseClientSettings(current)

  return normaliseClientSettings({
    ...base,
    ...patch,
    schemaVersion: 1,
    site: {
      ...base.site,
      ...(isObject(patch.site) ? patch.site : {})
    },
    access: {
      ...base.access,
      ...(isObject(patch.access) ? patch.access : {})
    },
    monitoring: {
      ...base.monitoring,
      ...(isObject(patch.monitoring)
        ? patch.monitoring
        : {})
    },
    discovery: {
      ...base.discovery,
      ...(isObject(patch.discovery)
        ? patch.discovery
        : {})
    },
    remoteSupport: {
      ...base.remoteSupport,
      ...(isObject(patch.remoteSupport)
        ? patch.remoteSupport
        : {})
    },
    notifications: {
      ...base.notifications,
      ...(isObject(patch.notifications)
        ? patch.notifications
        : {})
    }
  })
}

function validateClientSettings(value) {
  const sharePointUrl = cleanString(
    value.sharePointUrl,
    2000,
    'SharePoint URL'
  )

  if (sharePointUrl) {
    let parsed

    try {
      parsed = new URL(sharePointUrl)
    } catch {
      throw new Error('Invalid SharePoint URL')
    }

    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname.endsWith('.sharepoint.com')
    ) {
      throw new Error('Invalid SharePoint URL')
    }
  }

  const pollIntervalMinutes = Number(
    value.monitoring?.pollIntervalMinutes
  )

  if (
    !Number.isInteger(pollIntervalMinutes) ||
    pollIntervalMinutes < 1 ||
    pollIntervalMinutes > 1440
  ) {
    throw new Error(
      'Invalid monitoring poll interval'
    )
  }

  const recipients = Array.isArray(
    value.notifications?.recipients
  )
    ? value.notifications.recipients
        .map(item => cleanString(
          item,
          320,
          'Notification recipient'
        ))
        .filter(Boolean)
    : []

  for (const recipient of recipients) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new Error(
        `Invalid notification recipient: ${recipient}`
      )
    }
  }

  return {
    schemaVersion: 1,
    sharePointUrl,
    site: {
      type: enumValue(
        value.site?.type,
        siteTypes,
        'site type'
      ),
      reference: cleanString(
        value.site?.reference,
        250,
        'Site reference'
      ),
      timezone: cleanString(
        value.site?.timezone,
        100,
        'Timezone'
      ),
      notes: cleanString(
        value.site?.notes,
        5000,
        'Site notes'
      )
    },
    access: {
      provider: enumValue(
        value.access?.provider,
        accessProviders,
        'access provider'
      ),
      probeTarget: cleanString(
        value.access?.probeTarget,
        1000,
        'Access probe target'
      ),
      notes: cleanString(
        value.access?.notes,
        5000,
        'Access notes'
      )
    },
    monitoring: {
      enabled: booleanValue(
        value.monitoring?.enabled
      ),
      pollIntervalMinutes,
      internetCheckEnabled: booleanValue(
        value.monitoring?.internetCheckEnabled
      ),
      coreDeviceChecksEnabled: booleanValue(
        value.monitoring?.coreDeviceChecksEnabled
      ),
      domotzEnabled: booleanValue(
        value.monitoring?.domotzEnabled
      ),
      probeTarget: cleanString(
        value.monitoring?.probeTarget,
        1000,
        'Monitoring probe target'
      )
    },
    discovery: {
      enabled: booleanValue(
        value.discovery?.enabled
      ),
      method: enumValue(
        value.discovery?.method,
        discoveryMethods,
        'discovery method'
      ),
      subnet: cleanString(
        value.discovery?.subnet,
        100,
        'Discovery subnet'
      )
    },
    remoteSupport: {
      method: enumValue(
        value.remoteSupport?.method,
        remoteSupportMethods,
        'remote support method'
      ),
      clientApprovalRequired: booleanValue(
        value.remoteSupport?.clientApprovalRequired
      ),
      instructions: cleanString(
        value.remoteSupport?.instructions,
        5000,
        'Remote support instructions'
      )
    },
    notifications: {
      enabled: booleanValue(
        value.notifications?.enabled
      ),
      criticalOnly: booleanValue(
        value.notifications?.criticalOnly
      ),
      recipients: [...new Set(recipients)].slice(0, 50)
    }
  }
}

function enumValue(value, allowed, fieldName) {
  if (!allowed.has(value)) {
    throw new Error(`Invalid ${fieldName}`)
  }

  return value
}

function booleanValue(value) {
  return value === true
}

function cleanString(value, maxLength, fieldName) {
  const result =
    typeof value === 'string' ? value.trim() : ''

  if (result.length > maxLength) {
    throw new Error(`${fieldName} is too long`)
  }

  return result
}

function isObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

module.exports = {
  defaultClientSettings,
  normaliseClientSettings,
  mergeClientSettings
}
