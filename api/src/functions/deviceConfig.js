const { app } = require('@azure/functions')
const { getClientPrincipal } = require('../auth/clientPrincipal')
const {
  canAccessClient,
  canEditEngineeringData,
  hasWatchkeeperAccess
} = require('../auth/clientAccess')
const {
  readConfig,
  writeConfig
} = require('../storage/deviceConfigStore')

app.http('deviceConfig', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  route: 'device-config/{clientId}',

  handler: async request => {
    const principal = getClientPrincipal(request)

    if (!principal) {
      return json(401, {
        error: 'Authentication required'
      })
    }

    if (!hasWatchkeeperAccess(principal)) {
      return json(403, {
        error: 'Watchkeeper access is required'
      })
    }

    const clientId = request.params.clientId

    if (!clientId || String(clientId).length > 200) {
      return json(400, {
        error: 'Invalid Jetbuilt client ID'
      })
    }

    if (!canAccessClient(principal, clientId)) {
      return json(403, { error: 'Access to this client is not permitted' })
    }

    try {
      if (request.method === 'GET') {
        const result = await readConfig(clientId)

        return result
          ? json(200, result, {
              'Cache-Control': 'no-store'
            })
          : json(404, {
              error:
                'No device launcher is stored for this client'
            })
      }

      if (!canEditEngineeringData(principal)) {
        return json(403, {
          error: 'Administrator or engineer access is required to change the launcher'
        })
      }

      const config = validateConfig(await request.json())
      const expectedEtag =
        request.headers.get('if-match')

      const result = await writeConfig(
        clientId,
        config,
        principal.userDetails ||
          principal.userId ||
          'unknown',
        expectedEtag
      )

      return json(200, result, {
        'Cache-Control': 'no-store'
      })
    } catch (error) {
      console.error(
        'Device configuration request failed',
        error
      )

      if (error?.statusCode === 412) {
        return json(409, {
          error:
            'The launcher was changed by another user'
        })
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Device configuration request failed'

      const status =
        message.startsWith('Invalid') ||
        message.includes('required') ||
        message.includes('maximum') ||
        message.includes('unknown group') ||
        message.includes('GUDE power') ||
        message.includes('already assigned')
          ? 400
          : 500

      return json(status, { error: message })
    }
  }
})

function validateConfig(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid device configuration')
  }

  if (!Array.isArray(value.groups)) {
    throw new Error('Device groups are required')
  }

  if (!Array.isArray(value.devices)) {
    throw new Error('Devices are required')
  }

  if (value.groups.length > 50) {
    throw new Error('A maximum of 50 groups is supported')
  }

  if (value.devices.length > 500) {
    throw new Error('A maximum of 500 devices is supported')
  }

  const groupIds = new Set()

  const groups = value.groups.map(group => {
    const id = requiredString(
      group?.id,
      'Group ID',
      100
    )

    if (groupIds.has(id)) {
      throw new Error(`Duplicate group ID: ${id}`)
    }

    groupIds.add(id)

    return {
      id,
      title: requiredString(
        group?.title,
        'Group title',
        160
      ),
      accent:
        optionalString(group?.accent, 120) ||
        'rgba(59, 130, 246, 0.42)'
    }
  })

  const deviceIds = new Set()

  const devices = value.devices.map(device => {
    const id = requiredString(
      device?.id,
      'Device ID',
      120
    )

    if (deviceIds.has(id)) {
      throw new Error(`Duplicate device ID: ${id}`)
    }

    deviceIds.add(id)

    const group = requiredString(
      device?.group,
      'Device group',
      100
    )

    if (!groupIds.has(group)) {
      throw new Error(
        `Device references unknown group: ${group}`
      )
    }

    const result = {
      id,
      title: requiredString(
        device?.title,
        'Device title',
        200
      ),
      link: requiredString(
        device?.link,
        'Device URL',
        2048
      ),
      group
    }

    if (device.details !== undefined) {
      result.details = validateDetails(
        device.details
      )
    }

    if (device.powerControl !== undefined) {
      result.powerControl = validatePowerControl(
        device.powerControl
      )
    }

    if (device.powerOutlet !== undefined) {
      result.powerOutlet = validatePowerOutlet(device.powerOutlet)
    }

    return result
  })

  const devicesById = new Map(devices.map(device => [device.id, device]))
  const assignedPowerOutlets = new Map()
  for (const device of devices) {
    if (!device.powerOutlet) continue
    const source = devicesById.get(device.powerOutlet.gudeDeviceId)
    if (!source?.powerControl || source.powerControl.provider !== 'gude') {
      throw new Error(
        `Device references unknown GUDE power source: ${device.powerOutlet.gudeDeviceId}`
      )
    }

    const outletKey = `${device.powerOutlet.gudeDeviceId}:${device.powerOutlet.port}`
    const existingDevice = assignedPowerOutlets.get(outletKey)
    if (existingDevice) {
      throw new Error(
        `GUDE power outlet is already assigned to device: ${existingDevice}`
      )
    }
    assignedPowerOutlets.set(outletKey, device.id)
  }

  const config = {
    version:
      Number.isInteger(value.version)
        ? value.version
        : 1,
    groups,
    devices
  }

  if (
    Buffer.byteLength(
      JSON.stringify(config),
      'utf8'
    ) > 900000
  ) {
    throw new Error(
      'Device configuration exceeds the maximum size'
    )
  }

  return config
}

function validatePowerControl(value) {
  if (!value || typeof value !== 'object' || value.provider !== 'gude') {
    throw new Error('Invalid device power control')
  }

  return {
    provider: 'gude',
    model: requiredString(value.model, 'GUDE model', 200)
  }
}

function validatePowerOutlet(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid device power outlet')
  }
  const port = Number(value.port)
  if (!Number.isInteger(port) || port < 1 || port > 64) {
    throw new Error('Invalid GUDE power outlet port')
  }
  return {
    gudeDeviceId: requiredString(
      value.gudeDeviceId,
      'GUDE power source device ID',
      120
    ),
    port
  }
}

function validateDetails(details) {
  if (!details || typeof details !== 'object') {
    throw new Error('Invalid device map')
  }

  if (!Array.isArray(details.rows)) {
    throw new Error('Device map rows are required')
  }

  return {
    type:
      optionalString(details.type, 100) ||
      'map',
    title:
      optionalString(details.title, 200) ||
      'Device map',
    rows: details.rows.map(row => {
      if (!Array.isArray(row)) {
        throw new Error(
          'Each device map row must be an array'
        )
      }

      return row.map(cell =>
        Array.isArray(cell)
          ? cell.map(item =>
              String(item).slice(0, 500)
            )
          : String(cell ?? '').slice(0, 1000)
      )
    })
  }
}

function requiredString(
  value,
  label,
  maximumLength
) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`)
  }

  if (value.length > maximumLength) {
    throw new Error(
      `${label} must be ${maximumLength} characters or fewer`
    )
  }

  return value.trim()
}

function optionalString(value, maximumLength) {
  return typeof value === 'string'
    ? value.trim().slice(0, maximumLength)
    : ''
}

function json(status, jsonBody, headers = {}) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    jsonBody
  }
}
