const test = require('node:test')
const assert = require('node:assert/strict')
const { validateConfig } = require('../src/config')

test('accepts a loopback helper configuration', () => {
  const config = validateConfig({
    allowedOrigins: ['https://app.mptech.solutions'],
    devices: [{
      clientId: '1',
      deviceId: 'gude-1',
      baseUrl: 'http://192.0.2.10',
      model: 'Expert Power Control 8041-1',
      username: 'user',
      password: 'secret',
      portCount: 12,
      protectedPorts: [1]
    }]
  })
  assert.equal(config.port, 47832)
  assert.equal(config.devices[0].protectedPorts[0], 1)
})

test('rejects credentials embedded in a device URL', () => {
  assert.throws(() => validateConfig({
    allowedOrigins: ['https://app.mptech.solutions'],
    devices: [{
      clientId: '1',
      deviceId: 'gude-1',
      baseUrl: 'http://user:secret@192.0.2.10',
      model: 'Expert Power Control 8041-1',
      username: 'user',
      password: 'secret',
      portCount: 12
    }]
  }), /invalid base URL/)
})
