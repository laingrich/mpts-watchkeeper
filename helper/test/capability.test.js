const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const {
  issueHelperCapability
} = require('../../api/src/security/helperCapability')
const {
  requireGudePermission
} = require('../../api/src/security/gudeControlAccess')
const { verifyHelperCapability } = require('../src/capability')

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
const privateKeyBase64 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')
const publicKeyBase64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64')

function issue(overrides = {}) {
  return issueHelperCapability({
    privateKeyBase64,
    actor: 'admin@example.test',
    clientId: 'client-1',
    deviceId: 'gude-1',
    permission: 'gude:rename',
    nowSeconds: 1_000,
    ...overrides
  }).token
}

test('accepts a signed short-lived capability for the configured device', () => {
  const payload = verifyHelperCapability(issue(), publicKeyBase64, {
    clientId: 'client-1',
    deviceId: 'gude-1',
    permission: 'gude:rename'
  }, { nowSeconds: 1_030 })

  assert.equal(payload.actor, 'admin@example.test')
})

test('rejects altered, expired and cross-device capabilities', () => {
  const token = issue()
  const parts = token.split('.')
  parts[1] = `${parts[1].slice(0, -1)}A`

  assert.throws(() => verifyHelperCapability(parts.join('.'), publicKeyBase64, {
    clientId: 'client-1', deviceId: 'gude-1', permission: 'gude:rename'
  }, { nowSeconds: 1_030 }), /invalid/)

  assert.throws(() => verifyHelperCapability(token, publicKeyBase64, {
    clientId: 'client-1', deviceId: 'gude-2', permission: 'gude:rename'
  }, { nowSeconds: 1_030 }), /invalid or has expired/)

  assert.throws(() => verifyHelperCapability(token, publicKeyBase64, {
    clientId: 'client-1', deviceId: 'gude-1', permission: 'gude:rename'
  }, { nowSeconds: 1_061 }), /invalid or has expired/)
})

test('GUDE rename authorisation allows engineers and admins but not operators', () => {
  assert.throws(() => requireGudePermission({
    userRoles: ['authenticated', 'watchkeeper_operator']
  }, 'saltmarsh-id', 'gude:rename', JSON.stringify({
    'operator-id': ['saltmarsh-id']
  })), error => error.statusCode === 403)

  assert.equal(requireGudePermission({
    userRoles: ['authenticated', 'watchkeeper_admin']
  }, 'saltmarsh-id', 'gude:rename').userRoles[1], 'watchkeeper_admin')

  assert.equal(requireGudePermission({
    userRoles: ['authenticated', 'watchkeeper_engineer']
  }, 'saltmarsh-id', 'gude:rename').userRoles[1], 'watchkeeper_engineer')
})

test('site-scoped operators can obtain operate permission only for their client', () => {
  const operator = {
    userId: 'operator-id',
    userRoles: ['authenticated', 'watchkeeper_operator']
  }
  const access = JSON.stringify({ 'operator-id': ['saltmarsh-id'] })

  assert.equal(requireGudePermission(
    operator, 'saltmarsh-id', 'gude:operate', access
  ).userId, 'operator-id')
  assert.throws(() => requireGudePermission(
    operator, 'another-client', 'gude:operate', access
  ), error => error.statusCode === 403)
})
