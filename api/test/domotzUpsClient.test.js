const test = require('node:test')
const assert = require('node:assert/strict')
const {
  batteryTransferEvents,
  getUpsMonitoring
} = require('../src/integrations/domotzClient')

const configuration = {
  baseUrl: 'https://api-eu-west-1-cell-1.domotz.com/public-api/v1',
  apiKey: 'test-key'
}

test('reads Eaton UPS metrics and source-change history from Domotz', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname + new URL(url).search
    requests.push(path)
    assert.equal(options.method, 'GET')

    if (path.endsWith('/agent/12345/device?show_hidden=false')) {
      return response(200, [
        device('1001', 'UPS A', 'Equipment Room'),
        device('1002', 'UPS B', 'Plant Room'),
        {
          id: 99,
          display_name: 'Not a UPS',
          vendor: 'Another vendor'
        }
      ])
    }

    if (path.includes('/device/1001/variable?')) {
      return response(200, upsVariables({
        outputSourceId: '3001',
        voltage: '198',
        runtime: '32'
      }))
    }

    if (path.includes('/device/1001/variable/3001/history?')) {
      return response(200, [
        { timestamp: '2026-08-02T10:20:00+00:00', value: 'normal' },
        { timestamp: '2026-08-02T10:00:00+00:00', value: 'battery' }
      ])
    }

    if (path.includes('/device/1002/variable?')) {
      return response(200, upsVariables({
        outputSourceId: '3002',
        voltage: '52.4',
        runtime: '49'
      }))
    }

    if (path.includes('/device/1002/variable/3002/history?')) {
      return response(200, [])
    }

    assert.fail(`Unexpected Domotz request: ${path}`)
  }

  const result = await getUpsMonitoring('12345', {
    configuration,
    fetchImpl,
    historyDays: 30,
    now: '2026-08-06T12:00:00Z'
  })

  assert.equal(requests.length, 5)
  assert.equal(result.historyDays, 30)
  assert.equal(result.devices.length, 2)

  const upsA = result.devices.find(device => device.id === '1001')
  assert.equal(upsA.outputSource, 'normal')
  assert.equal(upsA.batteryChargePercent, 100)
  assert.equal(upsA.estimatedMinutesRemaining, 32)
  assert.equal(upsA.batteryVoltage, 198)
  assert.equal(upsA.alarmsPresent, 0)
  assert.deepEqual(upsA.batteryTransfers, [
    {
      startedAt: '2026-08-02T10:00:00.000Z',
      endedAt: '2026-08-02T10:20:00.000Z',
      durationSeconds: 1200
    }
  ])

  const upsB = result.devices.find(device => device.id === '1002')
  assert.equal(upsB.location, 'Plant Room')
  assert.equal(upsB.estimatedMinutesRemaining, 49)
  assert.deepEqual(upsB.batteryTransfers, [])
})

test('reports an ongoing battery transfer without inventing a start time', () => {
  assert.deepEqual(batteryTransferEvents([], 'battery'), [
    {
      startedAt: null,
      endedAt: null,
      durationSeconds: null
    }
  ])
})

function device(id, name, room) {
  return {
    id,
    display_name: name,
    vendor: 'Eaton Corporation',
    status: 'ONLINE',
    importance: 'VITAL',
    details: {
      room,
      zone: 'Basement'
    }
  }
}

function upsVariables({ outputSourceId, voltage, runtime }) {
  const prefix = 'snmp/preset/ups-basic-info'
  const observed = '2026-08-06T11:30:00+00:00'

  return [
    variable(outputSourceId, `${prefix}/upsOutputSource`, 'normal', observed),
    variable(2, `${prefix}/upsBatteryStatus`, 'batteryNormal', observed),
    variable(3, `${prefix}/upsBatteryVoltage`, voltage, observed),
    variable(4, `${prefix}/upsEstimatedMinutesRemaining`, runtime, observed),
    variable(5, `${prefix}/upsEstimatedChargeRemaining`, '100', observed),
    variable(6, `${prefix}/upsAlarmsPresent`, '0', observed)
  ]
}

function variable(id, path, value, valueUpdateTime) {
  return {
    id,
    path,
    value,
    value_update_time: valueUpdateTime
  }
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body
    }
  }
}
