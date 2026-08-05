const {
  canAccessClient,
  canEditEngineeringData
} = require('../auth/clientAccess')

const OPERATE_PERMISSION = 'gude:operate'
const RENAME_PERMISSION = 'gude:rename'

function requireGudePermission(principal, clientId, permission, accessSetting) {
  if (!principal) {
    throw accessError('Authentication required', 401)
  }

  if (permission === RENAME_PERMISSION) {
    if (!canEditEngineeringData(principal)) {
      throw accessError('Watchkeeper administrator or engineer access is required', 403)
    }
    return principal
  }

  if (permission === OPERATE_PERMISSION) {
    if (!canAccessClient(principal, clientId, accessSetting)) {
      throw accessError('Access to this client is not permitted', 403)
    }
    return principal
  }

  throw accessError('Unsupported helper permission', 400)
}

function accessError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode })
}

module.exports = {
  OPERATE_PERMISSION,
  RENAME_PERMISSION,
  requireGudePermission
}
