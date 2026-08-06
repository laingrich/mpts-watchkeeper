const test = require('node:test')
const assert = require('node:assert/strict')
const { handleGudePower } = require('../src/functions/gudePower')

const originalFetch = global.fetch
const originalBaseUrl = process.env.DOMOTZ_API_BASE_URL
const originalApiKey = process.env.DOMOTZ_API_KEY
const originalOperatorAccess = process.env.WATCHKEEPER_OPERATOR_CLIENT_ACCESS

test.beforeEach(() => {
  process.env.DOMOTZ_API_BASE_URL = 'https://api-eu-west-1-cell-1.domotz.com/public-api/v1'
  process.env.DOMOTZ_API_KEY = 'test-key'
  delete process.env.WATCHKEEPER_OPERATOR_CLIENT_ACCESS
})

test.after(() => {
  global.fetch = originalFetch
  restoreEnvironment('DOMOTZ_API_BASE_URL', originalBaseUrl)
  restoreEnvironment('DOMOTZ_API_KEY', originalApiKey)
  restoreEnvironment('WATCHKEEPER_OPERATOR_CLIENT_ACCESS', originalOperatorAccess)
})

test('returns Domotz outlet status to an authorised engineer', async () => {
  global.fetch = async (url, options) => {
    assert.equal(options.method, 'GET')
    assert.match(url.toString(), /agent\/312985\/device\/18306716\/power-outlet$/)
    return response(200, [
      { id: '1', name: 'Amplifier', power: 'ON', can_write: true }
    ])
  }

  const result = await handleGudePower(
    request({
      method: 'GET',
      role: 'watchkeeper_engineer'
    }),
    dependencies()
  )

  assert.equal(result.status, 200)
  assert.equal(result.jsonBody.dataSource, 'domotz')
  assert.equal(result.jsonBody.ports[0].name, 'Amplifier')
})

test('denies an operator who is not assigned to the requested client', async () => {
  global.fetch = async () => assert.fail('Domotz must not be called')

  const result = await handleGudePower(
    request({
      method: 'POST',
      role: 'watchkeeper_operator',
      body: { port: 1, action: 'off' }
    }),
    dependencies()
  )

  assert.equal(result.status, 403)
})

test('allows an assigned operator to power cycle a writable outlet', async () => {
  process.env.WATCHKEEPER_OPERATOR_CLIENT_ACCESS = JSON.stringify({
    'operator-id': ['463549']
  })
  const calls = []
  global.fetch = async (url, options) => {
    calls.push({ url: url.toString(), method: options.method })
    return options.method === 'GET'
      ? response(200, [{ id: '3', name: 'AV rack fan', power: 'ON', can_write: true }])
      : response(202)
  }

  const result = await handleGudePower(
    request({
      method: 'POST',
      role: 'watchkeeper_operator',
      userId: 'operator-id',
      body: { port: 3, action: 'reset' }
    }),
    dependencies()
  )

  assert.equal(result.status, 202)
  assert.equal(result.jsonBody.action, 'cycle')
  assert.equal(calls.length, 2)
  assert.match(calls[1].url, /power-outlet\/3\/action\/cycle$/)
  assert.equal(calls[1].method, 'POST')
})

function request({ method, role, userId = 'user-id', body }) {
  const principal = Buffer.from(JSON.stringify({
    userId,
    userDetails: `${userId}@example.test`,
    userRoles: ['authenticated', role]
  })).toString('base64')

  return {
    method,
    params: {
      clientId: '463549',
      deviceId: 'dev-gude-av1'
    },
    headers: {
      get(name) {
        return name.toLowerCase() === 'x-ms-client-principal' ? principal : null
      }
    },
    async json() {
      return body
    }
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

function dependencies() {
  return {
    async readClientSettings() {
      return {
        settings: {
          integrations: {
            domotz: { agentId: '312985' }
          }
        }
      }
    }
  }
}

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
