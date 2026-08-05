const crypto = require('node:crypto')

const ISSUER = 'mpts-watchkeeper'
const AUDIENCE = 'watchkeeper-local-helper'

function issueHelperCapability({
  privateKeyBase64,
  actor,
  clientId,
  deviceId,
  permission,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 60
}) {
  if (!privateKeyBase64) {
    throw new Error('Watchkeeper helper signing is not configured')
  }

  const payload = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: actor,
    actor,
    clientId,
    deviceId,
    permissions: [permission],
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    nonce: crypto.randomUUID()
  }
  const header = { alg: 'EdDSA', typ: 'JWT' }
  const unsigned = `${encodeJson(header)}.${encodeJson(payload)}`
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyBase64, 'base64'),
    format: 'der',
    type: 'pkcs8'
  })
  const signature = crypto.sign(null, Buffer.from(unsigned), privateKey)

  return {
    token: `${unsigned}.${signature.toString('base64url')}`,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  }
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

module.exports = {
  AUDIENCE,
  ISSUER,
  issueHelperCapability
}
