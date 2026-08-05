const crypto = require('node:crypto')

const ISSUER = 'mpts-watchkeeper'
const AUDIENCE = 'watchkeeper-local-helper'

function verifyHelperCapability(token, publicKeyBase64, expected, options = {}) {
  if (!publicKeyBase64) {
    throw capabilityError('GUDE name editing is not configured', 503)
  }

  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw capabilityError('Administrator authorisation is invalid')

  let header
  let payload
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    throw capabilityError('Administrator authorisation is invalid')
  }

  if (header?.alg !== 'EdDSA' || header?.typ !== 'JWT') {
    throw capabilityError('Administrator authorisation is invalid')
  }

  let publicKey
  try {
    publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki'
    })
  } catch {
    throw capabilityError('GUDE name editing authorisation is misconfigured', 503)
  }

  const signatureValid = crypto.verify(
    null,
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], 'base64url')
  )
  if (!signatureValid) throw capabilityError('Administrator authorisation is invalid')

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const permissions = Array.isArray(payload.permissions) ? payload.permissions : []
  const valid = payload.iss === ISSUER &&
    payload.aud === AUDIENCE &&
    payload.clientId === expected.clientId &&
    payload.deviceId === expected.deviceId &&
    permissions.includes(expected.permission) &&
    typeof payload.actor === 'string' && payload.actor.length > 0 &&
    Number.isInteger(payload.iat) && payload.iat <= nowSeconds + 30 &&
    Number.isInteger(payload.exp) && payload.exp >= nowSeconds &&
    payload.exp - payload.iat <= 120

  if (!valid) throw capabilityError('Administrator authorisation is invalid or has expired')
  return payload
}

function capabilityError(message, statusCode = 403) {
  return Object.assign(new Error(message), {
    code: 'HELPER_AUTHORISATION_FAILED',
    statusCode
  })
}

module.exports = { verifyHelperCapability }
