const test = require('node:test')
const assert = require('node:assert/strict')
const {
  buildCommandUrl,
  buildPortNameOid,
  normaliseStatus,
  performAction,
  renamePort,
  validatePortName
} = require('../src/gudeClient')

const device = {
  clientId: 'client-1',
  deviceId: 'gude-1',
  baseUrl: 'http://192.0.2.10',
  model: 'Expert Power Control 8041-1',
  username: 'user',
  password: 'secret',
  snmpWriteCommunity: 'private',
  portCount: 2,
  protectedPorts: [2]
}

test('builds explicit GUDE On, Off and Reset commands', () => {
  assert.equal(buildCommandUrl(device.baseUrl, 1, 'on').pathname, '/ov.html')
  assert.equal(buildCommandUrl(device.baseUrl, 1, 'on').search, '?cmd=1&p=1&s=1')
  assert.equal(buildCommandUrl(device.baseUrl, 1, 'off').search, '?cmd=1&p=1&s=0')
  assert.equal(buildCommandUrl(device.baseUrl, 1, 'reset').search, '?cmd=12&p=1')
})

test('normalises GUDE output states and protection', () => {
  const result = normaliseStatus({
    outputs: [
      { name: 'Amplifier', state: 1, batch: [0, 0] },
      { name: 'Network', state: 0, batch: [0, 3] }
    ]
  }, device)

  assert.deepEqual(result.ports.map(port => ({
    number: port.number,
    name: port.name,
    state: port.state,
    resetting: port.resetting,
    protected: port.protected
  })), [
    { number: 1, name: 'Amplifier', state: 'on', resetting: false, protected: false },
    { number: 2, name: 'Network', state: 'off', resetting: true, protected: true }
  ])
  assert.equal(result.dataSource, 'live')
})

test('refuses protected ports before making a request', async () => {
  await assert.rejects(
    performAction(device, 2, 'off', {
      fetchImpl: async () => { throw new Error('must not be called') }
    }),
    error => error.code === 'GUDE_PORT_PROTECTED'
  )
})

test('sends a Basic-authenticated command and then refreshes status', async () => {
  const requested = []
  const unprotectedDevice = { ...device, protectedPorts: [] }
  const fetchImpl = async (url, options) => {
    requested.push({ url: new URL(url), options })
    return requested.length === 1
      ? { ok: true, status: 200 }
      : {
          ok: true,
          status: 200,
          json: async () => ({ outputs: [{ name: 'Amplifier', state: 1 }] })
        }
  }

  const result = await performAction(unprotectedDevice, 1, 'on', { fetchImpl })

  assert.equal(requested.length, 2)
  assert.equal(requested[0].url.pathname, '/ov.html')
  assert.equal(requested[0].url.search, '?cmd=1&p=1&s=1')
  assert.equal(requested[1].url.pathname, '/statusjsn.js')
  assert.equal(requested[1].url.search, '?components=1')
  assert.match(requested[0].options.headers.Authorization, /^Basic /)
  assert.equal(result.ports[0].state, 'on')
})

test('maps supported GUDE models to the single writable port-name OID', () => {
  assert.equal(
    buildPortNameOid('Expert Power Control 8041-1', 3),
    '1.3.6.1.4.1.28507.85.1.3.1.2.1.2.3'
  )
  assert.equal(
    buildPortNameOid('Expert Power Control 8031-1', 8),
    '1.3.6.1.4.1.28507.81.1.3.1.2.1.2.8'
  )
  assert.throws(() => buildPortNameOid('Unknown GUDE', 1), /not supported/)
})

test('validates GUDE name limits before any write', () => {
  assert.doesNotThrow(() => validatePortName(device, 1, 'Rack fan'))
  assert.throws(() => validatePortName(device, 1, '1234567890123456'), /limited to 15/)
  assert.throws(() => validatePortName(device, 1, ' bad '), /spaces/)
})

test('renames only the selected SNMP name OID and verifies the GUDE result', async () => {
  let reads = 0
  let setRequest
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      outputs: [{ name: reads++ === 0 ? 'Amplifier' : 'Cinema AVR', state: 1 }]
    })
  })

  const result = await renamePort(device, 1, 'Cinema AVR', {
    fetchImpl,
    waitForSettle: async () => {},
    snmpSetImpl: async request => { setRequest = request }
  })

  assert.deepEqual(setRequest, {
    host: '192.0.2.10',
    community: 'private',
    oid: '1.3.6.1.4.1.28507.85.1.3.1.2.1.2.1',
    name: 'Cinema AVR'
  })
  assert.equal(result.oldName, 'Amplifier')
  assert.equal(result.newName, 'Cinema AVR')
  assert.equal(result.status.ports[0].name, 'Cinema AVR')
})
