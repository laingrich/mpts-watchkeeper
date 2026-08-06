const test = require('node:test')
const assert = require('node:assert/strict')
const {
  DomotzApiError,
  getPowerOutlets,
  triggerPowerOutletAction
} = require('../src/integrations/domotzClient')

const configuration = {
  baseUrl: 'https://api-eu-west-1-cell-1.domotz.com/public-api/v1',
  apiKey: 'test-key'
}

test('reads, normalises and numerically sorts Domotz power outlets', async () => {
  let requestedUrl
  const fetchImpl = async (url, options) => {
    requestedUrl = url.toString()
    assert.equal(options.method, 'GET')
    assert.equal(options.headers['X-Api-Key'], 'test-key')
    return response(200, [
      { id: '10', name: 'GUDE name 10', custom_name: 'Ignored', power: 'OFF', can_write: true },
      { id: '2', name: 'GUDE name 2', custom_name: 'Also ignored', power: 'ON', can_write: false }
    ])
  }

  const outlets = await getPowerOutlets('312985', '18306716', {
    configuration,
    fetchImpl
  })

  assert.equal(
    requestedUrl,
    'https://api-eu-west-1-cell-1.domotz.com/public-api/v1/agent/312985/device/18306716/power-outlet'
  )
  assert.deepEqual(outlets, [
    { id: '2', number: 2, name: 'GUDE name 2', state: 'on', canWrite: false },
    { id: '10', number: 10, name: 'GUDE name 10', state: 'off', canWrite: true }
  ])
})

test('posts a supported power action to the selected Domotz outlet', async () => {
  let request
  const fetchImpl = async (url, options) => {
    request = { url: url.toString(), options }
    return response(202)
  }

  await triggerPowerOutletAction('312985', '18306716', '3', 'cycle', {
    configuration,
    fetchImpl
  })

  assert.equal(
    request.url,
    'https://api-eu-west-1-cell-1.domotz.com/public-api/v1/agent/312985/device/18306716/power-outlet/3/action/cycle'
  )
  assert.equal(request.options.method, 'POST')
})

test('rejects unsupported actions before making a request', async () => {
  await assert.rejects(
    triggerPowerOutletAction('312985', '18306716', '3', 'rename', {
      configuration,
      fetchImpl: async () => assert.fail('fetch must not run')
    }),
    error => error instanceof DomotzApiError && error.code === 'DOMOTZ_INVALID_ACTION'
  )
})

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body
    }
  }
}
